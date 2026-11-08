# H3 Director Studio V2

H3 Director Studio is a ComfyUI node for planning and rendering MiniMax H3 video in reviewable segments. It generates a BASE pass, lets you keep that exact BASE, applies the 3D latent upscale, and uses separate BASE and FINAL Motion Context checkpoints for the next segment.

The repository contains the Director node and a clean, pinned reference workflow. It does **not** bundle MiniMax H3 models, LoRAs, third-party custom nodes, reference files, audio, generated videos, or personal prompts.

## Workflow running

![H3 Director Studio V2 running in ComfyUI](assets/H3_Director_Studio_V2_running.png)

This screenshot shows the full workflow while rendering: BASE references, Spectrum on the BASE branch, the Director controls, optional BASE preview, and final video output.

## Install

1. Install a current ComfyUI build with native MiniMax H3 support.
2. Install the runtime dependencies listed in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).
3. Copy this folder to `ComfyUI/custom_nodes/H3_Director_Studio`.
4. Restart ComfyUI and load [workflows/H3_DIRECTOR_STUDIO_V2.json](workflows/H3_DIRECTOR_STUDIO_V2.json).

## Core workflow

Connect the BASE model and CLIP, the Upscale model and CLIP, the video/audio VAEs, and an optional H3 reference bundle. Add a global prompt and one prompt per segment.

- **Generate BASE** renders only the current BASE pass for review.
- **Accept BASE → Upscale** keeps that exact accepted BASE and performs the 3D latent upscale.
- **Generate BASE + Upscale** renders both passes without stopping for review.
- **Chain** continues from the next pending segment using the saved continuity state.

The workflow includes a standard BASE path and a separate Upscale path. BASE and Upscale samplers, schedulers, steps, denoise, latent multiplier and the 3D latent upscaler model remain configurable from the Director.

## Using the buttons

### Manual clip workflow

1. Choose the clip with **Set active clip**. For clip `N`, the Director loads continuity slot `N−1` and saves slot `N`.
2. Set the switch to **Generate BASE**, then press **Generate clip N** to render and review just the current BASE pass.
3. Press **Keep BASE → Upscale** to upscale that exact accepted BASE pass.
4. Press **Approve final → next clip** to move the selector to the following clip and prepare its next BASE pass.

Set the switch to **Generate final** when the current clip does not need a separate BASE review; **Generate clip N** then runs BASE + 3D latent upscale in one execution.

### Automated sequence

**Run Chain** follows the active clip selector:

- If the selected clip has no saved FINAL continuity latent, Chain renders that clip first, including BASE and upscale.
- If it already has a FINAL continuity latent, Chain continues from the following clip.
- The selector advances automatically as each clip completes.

Use **Clear temporary latents** only when you want to begin the project again from clip 1. It deletes the current project's numbered BASE and FINAL continuity latents and returns the selector to clip 1. It does not delete exported videos.

## Dual Motion Context: BASE and FINAL

H3 Director Studio automatically saves **two separate audiovisual latent checkpoints for each completed clip**. Each checkpoint carries both picture and sound into the matching stage of the next clip:

- **BASE latent:** the next clip's BASE generation uses the previous clip's BASE latent to continue its motion and audio.
- **FINAL latent:** after the 3D latent upscale, the next clip's upscale pass uses the previous clip's FINAL latent at the final resolution. This carries the upscale-stage result across the join, helping maintain visual and audio continuity in the finished clips.

**Why two latents?** Continuity at BASE resolution alone does not ensure that the independently upscaled clips retain the same level of detail and appearance at the join. Carrying the previous FINAL latent into the next upscale pass helps reduce visible shifts in sharpness and detail between segments, while also carrying audio context forward. This aims for a smoother transition in the finished video; the result depends on the clips and settings.

For example, clip 2 uses BASE 1 to generate BASE 2, then FINAL 1 when producing FINAL 2. Each FINAL checkpoint is saved before the context is trimmed; Motion Context trims video and audio together for delivery. Results depend on the scene and settings.

- BASE slots: `ComfyUI/output/<project>/clip_00001.safetensors`.
- FINAL slots: `ComfyUI/output/<project>/final/clip_00001.safetensors`.
- Start a new project at clip 1 when first trying this update. Generating FINAL clip 2 requires a FINAL clip 1 saved by this version; an older MP4 or BASE checkpoint is not a substitute. Existing BASEs may be upscaled in order from clip 1.
- Keep the BASE dimensions, aspect ratio and upscale multiplier consistent throughout a chain. The previous FINAL context must match the current FINAL resolution. FINAL checkpoints require additional disk space.
- Re-rendering a clip overwrites its numbered continuity slot; later clips need to be regenerated to follow the new result. Preserve any checkpoints or outputs you want to keep before clearing or restarting a project.

## Spectrum in the included workflow

Spectrum is connected **only to the BASE pass**:

`BASE model → BASE LoRAs → Spectrum → Director`

Use it for non-Turbo BASE generations at approximately **25 steps**. It is not recommended with Turbo LoRAs or short Turbo step presets, and it is not used in the Latent 3D Upscale pass.

## Notes

- The clean workflow ships with empty references, audio sources, prompts and Writer history.
- Every node is pinned so the layout opens in a stable state.
- The included workflow is a complete preset. Its extra helper nodes are listed separately in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md); the Director itself does not bundle them.
- Model and LoRA filenames are examples. Replace them with compatible files installed on your system.

## Credits

Built around ComfyUI's native MiniMax H3 support, H3 Motion Context, and the compatible community nodes listed in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

## License

MIT. See [LICENSE](LICENSE).

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md).
