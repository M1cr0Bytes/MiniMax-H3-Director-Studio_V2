# H3 Director Studio V2

H3 Director Studio is a ComfyUI node for planning and rendering MiniMax H3 video in reviewable segments. It generates a BASE pass, lets you keep that exact BASE, applies the 3D latent upscale, and preserves continuity data for the next segment through Motion Context.

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
