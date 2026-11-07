"""H3 Director Studio V2 backend: expands native ComfyUI runtime nodes."""
import re
import random
import logging
from comfy_execution.graph_utils import GraphBuilder

WEB_DIRECTORY = './web'
HEADER = re.compile(r'^[ \t]*\[\s*SEGMENT\s+(\d+)\s*\][ \t]*$', re.I | re.M)
DEFAULT_SEGMENTS = '\n\n'.join(f'[SEGMENT {i}]\n' for i in range(1, 5))
LOG = logging.getLogger('h3_studio_v1')


def parse_segments(raw):
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError('H3 Director Studio: No segment prompts.')
    matches = list(HEADER.finditer(raw))
    if not matches or raw[:matches[0].start()].strip():
        raise ValueError('H3 Director Studio: The first line must be [SEGMENT 1].')
    result = []
    for i, match in enumerate(matches):
        number = int(match.group(1))
        if number != i + 1:
            raise ValueError(f'H3 Director Studio: Expected [SEGMENT {i+1}], got [SEGMENT {number}].')
        end = matches[i+1].start() if i + 1 < len(matches) else len(raw)
        result.append(raw[match.end():end].strip())
    return result


def safe_project(value):
    segments = str(value).strip().replace('\\', '/')
    if not segments or segments.startswith('/') or segments.startswith('.') or '..' in segments:
        raise ValueError('H3 Director Studio: Invalid project folder name.')
    if not re.fullmatch(r'[a-zA-Z0-9_/-]{1,120}', segments):
        raise ValueError('H3 Director Studio: Project folder accepts letters, digits, underscore, hyphen and / only.')
    return segments


class H3IntegratedVideoWriter:
    """Preserve original PixaromaSaveMp4 encoder and force base-continuity save first."""
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'frames': ('IMAGE',), 'audio': ('AUDIO',), 'saved_base_latent': ('STRING',),
            'filename_prefix': ('STRING', {'default': 'H3_Director'}),
            'save_mode': (['save', 'preview'], {'default': 'save'}),
        }, 'hidden': {'prompt': 'PROMPT', 'extra_pnginfo': 'EXTRA_PNGINFO'}}

    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('saved_clip',)
    FUNCTION = 'write'
    OUTPUT_NODE = True
    CATEGORY = 'MiniMax H3/Director/Internal'

    def write(self, frames, audio, saved_base_latent, filename_prefix, save_mode, prompt=None, extra_pnginfo=None):
        # Do not save MP4 here: images and audio leave through the Director outputs.
        # The dependency on saved_base_latent preserves the BASE continuity write.
        LOG.info('H3 V1 frames/audio ready; BASE latent saved: %s', saved_base_latent)
        return {'result': (f'{filename_prefix} (frames/audio ready; BASE continuity: {saved_base_latent})',)}


class H3DirectorStudioV1:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'base_model': ('MODEL',), 'base_clip': ('CLIP',),
                'upscale_model': ('MODEL',), 'upscale_clip': ('CLIP',),
                'video_vae': ('VAE',), 'audio_vae': ('VAE',),
                'general_prompt': ('STRING', {'multiline': True, 'dynamicPrompts': False, 'default': ''}),
                'segments_text': ('STRING', {'multiline': True, 'dynamicPrompts': False, 'default': DEFAULT_SEGMENTS}),
                'project_key': ('STRING', {'default': 'h3_director_project'}),
                'production_mode': (['Chain', 'Single'], {'default': 'Chain'}),
                'render_mode': (['Final', 'Preview base', 'Upscale accepted base'], {'default': 'Preview base'}),
                'duration_s': ('FLOAT', {'default': 13.0, 'min': 0.5, 'max': 180.0, 'step': 0.5}),
                'ratio': (['1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)',
                           '3:4 (Portrait Standard)', '4:3 (Standard)', '9:16 (Portrait Widescreen)',
                           '16:9 (Widescreen)', '21:9 (Ultrawide)'], {'default': '16:9 (Widescreen)'}),
                'megapixels': ('FLOAT', {'default': 0.4, 'min': 0.1, 'max': 4.0, 'step': 0.05}),
                'base_steps': ('INT', {'default': 8, 'min': 1, 'max': 100}),
                'refine_steps': ('INT', {'default': 4, 'min': 1, 'max': 100}),
                'upscale_multiplier': ('FLOAT', {'default': 1.5, 'min': 1.0, 'max': 3.0, 'step': 0.05}),
                'clip_index': ('INT', {'default': 1, 'min': 1, 'max': 9999}),
                'h3_rng_value': ('INT', {'default': 289186686312224, 'min': 0, 'max': 0xffffffffffffffff}),
                'seed_mode': (['randomize', 'fixed'], {'default': 'randomize'}),
                'base_sampler': ('STRING', {'default': 'euler'}),
                'base_scheduler': ('STRING', {'default': 'simple'}),
                'upscale_sampler': ('STRING', {'default': 'res_multistep'}),
                'upscale_scheduler': ('STRING', {'default': 'simple'}),
                'upscaler_model': ('STRING', {'default': 'minimax_h3_latent_upscaler_3d_conv_v1_fp16.safetensors'}),
            },
            'optional': {
                'refine_denoise': ('FLOAT', {'default': 0.20, 'min': 0.0, 'max': 1.0, 'step': 0.01}),
                'ref_images': ('DENO_MINIMAX_H3_REFERENCE_IMAGES',),
                'ref_video_0': ('IMAGE',),
                'ref_video_audio_0': ('AUDIO',),
                'ref_audio_0': ('AUDIO',),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'},
        }

    RETURN_TYPES = ('STRING', 'IMAGE', 'AUDIO')
    RETURN_NAMES = ('render_status', 'video_frames', 'video_audio')
    FUNCTION = 'run'
    OUTPUT_NODE = True
    CATEGORY = 'MiniMax H3/Director'
    DESCRIPTION = 'H3 Director Studio V2; BASE + UPSCALE + continuity dynamically executed inside this single node.'

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float('nan')

    def run(self, base_model, base_clip, upscale_model, upscale_clip, video_vae, audio_vae,
            general_prompt, segments_text, project_key, production_mode, render_mode,
            duration_s, ratio, megapixels, base_steps, refine_steps, upscale_multiplier,
            clip_index, h3_rng_value, seed_mode, base_sampler, base_scheduler,
            upscale_sampler, upscale_scheduler, upscaler_model,
            ref_images=None, ref_video_0=None, ref_video_audio_0=None, ref_audio_0=None, unique_id=None, refine_denoise=0.20):
        import math
        refine_denoise = float(refine_denoise)
        if not math.isfinite(refine_denoise) or not 0.0 <= refine_denoise <= 1.0:
            raise ValueError('Refine denoise debe estar entre 0 y 1.')
        shots = parse_segments(segments_text)
        project = safe_project(project_key)
        index = int(clip_index)
        if index < 1 or index > len(shots):
            raise ValueError(f'H3 Director Studio: Clip {index} is outside 1–{len(shots)} segment(s).')
        if not shots[index - 1]:
            raise ValueError(f'H3 Director Studio: Segment {index} has no prompt.')
        prompt_text = (str(general_prompt).strip() + '\n\n' + shots[index - 1]).strip()
        if not prompt_text:
            raise ValueError('H3 Director Studio: Empty prompt.')
        g = GraphBuilder()
        def add(name, **kwargs):
            return g.node(name, **kwargs)

        resolution = add('ResolutionSelector', aspect_ratio=ratio, megapixels=float(megapixels), multiple=32)
        frame_length = add('ComfyMathExpression', expression='max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17', **{'values.a': float(duration_s)})
        extras = {}
        if ref_images is not None: extras['ref_images'] = ref_images
        if ref_video_0 is not None: extras['ref_videos.ref_video_0'] = ref_video_0
        if ref_video_audio_0 is not None: extras['ref_video_audios.ref_video_audio_0'] = ref_video_audio_0
        if ref_audio_0 is not None: extras['ref_audios.ref_audio_0'] = ref_audio_0
        base_ref = add('DenoMiniMaxH3ReferenceToVideo',
                       clip=base_clip, vae=video_vae, audio_vae=audio_vae,
                       prompt=prompt_text, **extras,
                       width=resolution.out(0), height=resolution.out(1),
                       length=frame_length.out(1), ref_image_size='match')
        context_load = add('MiniMaxH3MotionContextLoadLatent', latent_path=project, clip_index=index - 1)
        motion = add('MiniMaxH3MotionContext',
                     conditioning=base_ref.out(0), vae=video_vae, latent=base_ref.out(1),
                     context_length=22, audio_context_length=24, context_latent=context_load.out(0),
                     audio_vae=audio_vae)
        # H3_DIRECTOR_BASE_REVIEW_ACCEPT_V3
        # KJ live preview is intentionally removed. Review the finished BASE clip instead.
        mode_preview = render_mode == 'Preview base'
        mode_accepted = render_mode == 'Upscale accepted base'
        if mode_accepted:
            # Exact BASE saved by the review pass. This Director-owned loader
            # returns the standard H3 AV latent format without changing Motion Context.
            accepted_base = add('H3DirectorAcceptedBaseLoad',
                                project_key=project, clip_index=index)
            base_latent = accepted_base.out(0)
            saved_continuity = f'{project}/clip_{index:05d}.safetensors'
        else:
            guider = add('BasicGuider', model=base_model, conditioning=motion.out(0))
            base_noise = add('RandomNoise', noise_seed=int(h3_rng_value))
            base_sampler_node = add('KSamplerSelect', sampler_name=base_sampler)
            base_sigmas = add('BasicScheduler', model=base_model,
                              scheduler=base_scheduler, steps=int(base_steps), denoise=1.0)
            base_output = add('SamplerCustomAdvanced',
                              noise=base_noise.out(0), guider=guider.out(0),
                              sampler=base_sampler_node.out(0), sigmas=base_sigmas.out(0),
                              latent_image=base_ref.out(1))
            save_base = add('H3DirectorSaveContinuity',
                            latent=base_output.out(1), filename_prefix=f'{project}/clip', clip_index=index)
            base_ready = add('H3DirectorLatentAfterSave',
                             latent=base_output.out(1), saved_path=save_base.out(0))
            base_latent = base_ready.out(0)
            saved_continuity = save_base.out(0)

        if mode_preview:
            final_latent = base_latent
        else:
            av_parts = add('LTXVSeparateAVLatent', av_latent=base_latent)
            latent3d = add('MinimaxH3LatentUpscaler3D',
                           latent=av_parts.out(0), model_name=upscaler_model,
                           mode='scale by multiplier', **{'mode.scale': float(upscale_multiplier)},
                           align=32, enable_temporal_chunking=True, force_unload=True,
                           device='cuda', precision='fp16')
            joint = add('LTXVConcatAVLatent', video_latent=latent3d.out(0), audio_latent=av_parts.out(1))
            final_width = add('ComfyMathExpression', expression='max(32, round(a*b/32)*32)',
                              **{'values.a': resolution.out(0), 'values.b': float(upscale_multiplier)})
            final_height = add('ComfyMathExpression', expression='max(32, round(a*b/32)*32)',
                               **{'values.a': resolution.out(1), 'values.b': float(upscale_multiplier)})
            upscale_ref = add('DenoMiniMaxH3ReferenceToVideo',
                             clip=upscale_clip, vae=video_vae, audio_vae=audio_vae,
                             prompt=prompt_text, **extras,
                             width=final_width.out(1), height=final_height.out(1),
                             length=frame_length.out(1), ref_image_size='match')
            windows = add('H3ContextWindows', model=upscale_model, window_seconds=5.0, overlap_seconds=1.3)
            upscale_guider = add('BasicGuider', model=windows.out(0), conditioning=upscale_ref.out(0))
            upscale_noise = add('RandomNoise', noise_seed=545916073993762)
            upscale_sampler_node = add('KSamplerSelect', sampler_name=upscale_sampler)
            upscale_sigmas = add('BasicScheduler', model=upscale_model,
                                 scheduler=upscale_scheduler, steps=int(refine_steps), denoise=refine_denoise)
            final_output = add('SamplerCustomAdvanced',
                               noise=upscale_noise.out(0), guider=upscale_guider.out(0),
                               sampler=upscale_sampler_node.out(0), sigmas=upscale_sigmas.out(0),
                               latent_image=joint.out(0))
            final_latent = final_output.out(1)
        images = add('VAEDecode', samples=final_latent, vae=video_vae)
        audio = add('VAEDecodeAudio', samples=final_latent, vae=audio_vae)
        # Base review must look exactly like the delivered clip: remove pinned context and align audio.
        trimmed = add('MiniMaxH3MotionContextTrim', images=images.out(0), audio=audio.out(0),
                      trim_frames=motion.out(1), fps=24.0, match_tail=True)
        frames_out, audio_out = trimmed.out(0), trimmed.out(1)
        writer = add('H3IntegratedVideoWriter',
                     frames=frames_out, audio=audio_out, saved_base_latent=saved_continuity,
                     filename_prefix=f'{project}/{"Base" if mode_preview else "Final"}_clip_{index:03}',
                     save_mode='save')
        if unique_id is not None:
            writer.set_override_display_id(str(unique_id))
        LOG.info('H3 Director Studio V2, clip=%s/%s, mode=%s, base=%d, upscale=%d',
                 index, len(shots), render_mode, base_steps, refine_steps)
        return {'expand': g.finalize(), 'result': (writer.out(0), frames_out, audio_out)}


class H3DirectorAcceptedBaseLoad:
    """Load an exact Director BASE as a normal H3 AV latent.

    Motion Context owns saving and continuity. This Director-owned adapter
    reads only the accepted project's numbered slot, so it needs no change
    whatsoever to the installed Motion Context extension.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "project_key": ("STRING", {"default": "h3_director_v1_project"}),
            "clip_index": ("INT", {"default": 1, "min": 1, "max": 9999}),
        }}

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "load"
    CATEGORY = "MiniMax H3/Director/Internal"

    @classmethod
    def IS_CHANGED(cls, project_key, clip_index):
        try:
            import folder_paths
            from pathlib import Path
            project = safe_project(project_key)
            root = Path(folder_paths.get_output_directory()).resolve()
            path = (root / project / ("clip_%05d.safetensors" % int(clip_index))).resolve()
            if root not in path.parents:
                return float("nan")
            return "%s:%d" % (path, path.stat().st_mtime_ns)
        except Exception:
            return float("nan")

    def load(self, project_key, clip_index):
        import folder_paths
        from pathlib import Path
        from safetensors.torch import load_file
        import comfy.nested_tensor
        project = safe_project(project_key)
        root = Path(folder_paths.get_output_directory()).resolve()
        path = (root / project / ("clip_%05d.safetensors" % int(clip_index))).resolve()
        if root not in path.parents:
            raise ValueError("H3 Director: invalid accepted BASE location.")
        if not path.is_file():
            raise FileNotFoundError("H3 Director: accepted BASE not found: %s" % path)
        data = load_file(str(path), device="cpu")
        if "video" not in data or "audio" not in data:
            raise ValueError("H3 Director: %s is not an H3 Motion Context AV latent." % path.name)
        video = data["video"].contiguous().clone()
        audio = data["audio"].contiguous().clone()
        return ({"samples": comfy.nested_tensor.NestedTensor((video, audio))},)


# H3_DIRECTOR_MODEL_RELEASE_V1
def _h3_director_release_models():
    """Unload all Comfy model patchers and return cached VRAM to CUDA."""
    import gc
    import comfy.model_management as model_management
    model_management.unload_all_models()
    gc.collect()
    model_management.soft_empty_cache(force=True)
    LOG.info('H3 Director released loaded models and cleared the GPU cache.')


def _register_h3_director_release_route():
    try:
        from aiohttp import web
        from server import PromptServer
    except ImportError:
        return
    server = getattr(PromptServer, 'instance', None)
    if server is None or getattr(_register_h3_director_release_route, '_done', False):
        return

    @server.routes.post('/h3_director/release_models')
    async def _release_models_route(_request):
        _h3_director_release_models()
        return web.json_response({'released': True})

    _register_h3_director_release_route._done = True


_register_h3_director_release_route()


NODE_CLASS_MAPPINGS = {
    'H3DirectorStudioV1': H3DirectorStudioV1,
    'H3IntegratedVideoWriter': H3IntegratedVideoWriter,
    'H3DirectorAcceptedBaseLoad': H3DirectorAcceptedBaseLoad,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    'H3DirectorStudioV1': 'H3 Director Studio',
    'H3IntegratedVideoWriter': 'H3 Internal Video Writer',
    'H3DirectorAcceptedBaseLoad': 'H3 Director Accepted BASE Loader',
}


# H3_DIRECTOR_BASE_CONTINUITY_V2
from .h3_double_save import NODE_CLASS_MAPPINGS as _double_save_nodes
NODE_CLASS_MAPPINGS.update(_double_save_nodes)

# H3_DIRECTOR_REFINE_DENOISE_V1
