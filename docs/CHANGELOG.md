# Changelog

## V2 UI hotfix

- Restored internal vertical scrolling; opening prompts no longer auto-resizes the node.
- Restored the Generate clip button beside the BASE/FINAL switch.
- Corrected BASE button selection and clip-selector detection in the V2 interface.

## V2

- Added a clean public workflow with no personal prompts, references, audio, render history or local output paths.
- Added BASE review flow: render a BASE pass, choose it, then upscale that exact accepted latent.
- Added a direct BASE + Upscale execution path for clips that do not need review.
- Consolidated BASE and Upscale controls for steps, samplers, schedulers, denoise, 3D multiplier and latent-upscaler model selection.
- Preserved segment continuity through the Director/Motion Context workflow.
- Added Spectrum to the included workflow for the **BASE pass only**.
  - Recommended configuration: non-Turbo BASE generation at approximately **25 steps**.
  - Do not use Spectrum with Turbo LoRAs or short Turbo step presets.
  - Spectrum is not used in the Latent 3D Upscale pass.

### Workflow housekeeping

- All workflow nodes are pinned.
- Reference images, reference audio, prompts, Creative Writer history, stored previews and local paths have been removed before publication.
