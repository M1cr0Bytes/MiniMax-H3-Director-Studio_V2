# Workflows

## H3 Director Studio V2

`H3_DIRECTOR_STUDIO_V2.json` is the clean, pinned public visual workflow for H3 Director Studio V2. It preserves the node layout, connections, native model-loader dropdowns and pin state.

References, prompts, Writer history and local output-preview data are intentionally empty. The in-canvas **README · Requirements and quick start** node lists the required custom-node packages, model examples, operating sequence and Spectrum guidance. Pixaroma is explicitly required because the visible Render Timer node belongs to it.

The BASE branch is:

`BASE model → BASE LoRAs → Spectrum → optional BASE preview → Director`

Spectrum is for non-Turbo BASE sampling at around 25 steps only. It is not used in the Latent 3D Upscale branch.

Install the packages listed in [../docs/DEPENDENCIES.md](../docs/DEPENDENCIES.md) before loading the preset.
