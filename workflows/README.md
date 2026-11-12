# Workflows

## H3 Director Studio V2

`H3_DIRECTOR_STUDIO_V2.json` is the clean, pinned public preset for H3 Director Studio V2. References, prompts, Writer history and local output data are intentionally empty.

The BASE branch is:

`BASE model → BASE LoRAs → Spectrum → optional BASE preview → Director`

Spectrum is for non-Turbo BASE sampling at around 25 steps only. It is not used in the Latent 3D Upscale branch.

Install the packages listed in [../docs/DEPENDENCIES.md](../docs/DEPENDENCIES.md) before loading the full preset.

## Annotated visual workflow

`H3_DIRECTOR_STUDIO_V2_ANNOTATED.json` is the visual companion workflow. It preserves the same Director wiring and preset settings while adding an in-canvas Markdown README with model names, dependency links, Spectrum guidance and the basic operating sequence. It ships with references, prompts, Writer state and output-preview state cleared.
