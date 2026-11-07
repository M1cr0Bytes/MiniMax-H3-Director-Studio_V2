# Installation

## 1. Install the Director

Clone this repository into ComfyUI's custom-node folder:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/M1cr0Bytes/MiniMax-H3-Chain-Director-V1.git H3_Director_Studio
```

Or extract the release ZIP so that `__init__.py` and `web/studio.js` sit directly inside `ComfyUI/custom_nodes/H3_Director_Studio`.

## 2. Install dependencies

Install a current ComfyUI build with native MiniMax H3 support, then install the packages listed in [DEPENDENCIES.md](DEPENDENCIES.md). The complete workflow has optional utility nodes; the Director's required runtime nodes are identified separately in that document.

Download compatible MiniMax H3 model weights, CLIP/text encoder, video VAE, audio VAE, 3D latent-upscaler model and any LoRAs separately. No model weights are included here.

## 3. Restart and verify

Restart ComfyUI. Search for **H3 Director Studio** in the node menu and load `workflows/H3_DIRECTOR_STUDIO_V2.json`.

For a first test, use a short clip, a small BASE resolution and your own authorized references. Confirm BASE generation first, then test **Accept BASE → Upscale**. Test Chain only after a successful single clip.

## Spectrum setup

The V2 workflow places Spectrum only in the BASE route, after the BASE LoRA stack. Use it for a non-Turbo BASE at around 25 steps. Do not use it with Turbo LoRAs, short Turbo schedules or the 3D latent-upscale branch.
