# Dependencies

## Director runtime

These components are required for the Director to execute its native H3 BASE, continuity and 3D latent-upscale paths.

| Component | Purpose |
| --- | --- |
| Current ComfyUI with native MiniMax H3 support | Core H3 model, conditioning, sampling and VAE nodes. |
| [ComfyUI-H3-Motion-Context](https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context) | Segment continuity for motion and audio. |
| A compatible `MinimaxH3LatentUpscaler3D` provider | The 3D latent upscale node used by the Director. |
| [ComfyUI-OBVPM-Timeline](https://github.com/chanon/comfyui-obvpm-timeline) | `H3ContextWindows` used in the Upscale branch. |
| MiniMax H3 BASE model, CLIP/text encoder, video VAE and audio VAE | Model assets; download separately. |

## Included workflow extras

The supplied workflow opens unchanged when these packages are installed. They are not bundled with H3 Director Studio.

| Component | Used for | Required to open unchanged? |
| --- | --- | --- |
| [Deno custom nodes](https://github.com/Deno2026/comfyui-deno-custom-nodes) | H3 reference-image/audio loader. | Yes |
| H3 Creative Writer | Optional prompt-writing helper. | Yes; remove it if not used. |
| [rgthree-comfy](https://github.com/rgthree/rgthree-comfy) | BASE and Upscale LoRA stacks. | Yes |
| [ComfyUI-Spectrum-MiniMax-H3](https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3) | Spectrum acceleration in BASE only. | Yes |
| [ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes) | Optional BASE preview. | Yes; remove or bypass if unused. |
| [ComfyUI-Pixaroma](https://gitlab.com/pixaroma/comfyui-pixaroma) | Run timer / presentation utility. | Yes; remove if unused. |
| [VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) | Final MP4 muxing and output. | Yes |

## Models and LoRAs

The workflow intentionally stores model and LoRA selectors rather than model files. Download the assets independently, place them in the folders expected by your ComfyUI setup, then choose equivalent compatible filenames if yours differ.

The supplied Spectrum branch is deliberately restricted to:

`BASE model → BASE LoRAs → Spectrum → Director`

Keep Spectrum out of the 3D latent-upscale branch. Use it with non-Turbo BASE sampling at about 25 steps; it is not recommended for Turbo LoRAs or short Turbo schedules.
