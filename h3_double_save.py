"""Internal save ordering for BASE-only Director continuity."""
import logging

LOG = logging.getLogger('h3_studio_v1')



class H3DirectorLatentAfterSave:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'latent': ('LATENT',), 'saved_path': ('STRING',)}}

    RETURN_TYPES = ('LATENT',)
    FUNCTION = 'ready'
    CATEGORY = 'MiniMax H3/Director/Internal'

    def ready(self, latent, saved_path):
        LOG.info('H3 Director continuity checkpoint ready: %s', saved_path)
        return (latent,)


class H3DirectorSaveContinuity:
    """Use Motion Context's writer but execute the side effect on every run."""
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'latent': ('LATENT',),
            'filename_prefix': ('STRING', {'default': 'h3_context/clip'}),
            'clip_index': ('INT', {'default': 1, 'min': 1, 'max': 9999}),
        }}

    RETURN_TYPES = ('STRING',)
    FUNCTION = 'save'
    OUTPUT_NODE = True
    CATEGORY = 'MiniMax H3/Director/Internal'

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float('nan')

    def save(self, latent, filename_prefix, clip_index):
        import nodes
        if int(clip_index) < 1:
            raise ValueError('H3 Director: continuity requires a fixed positive slot.')
        original = nodes.NODE_CLASS_MAPPINGS.get('MiniMaxH3MotionContextSaveLatent')
        if original is None:
            raise RuntimeError('H3 Director: Motion Context Save Latent is not installed.')
        return original().save(latent=latent, filename_prefix=filename_prefix,
                               clip_index=int(clip_index))


NODE_CLASS_MAPPINGS = {
    'H3DirectorLatentAfterSave': H3DirectorLatentAfterSave,
    'H3DirectorSaveContinuity': H3DirectorSaveContinuity,
}
