# H3 Director Studio V1 — Legacy Archive

This folder preserves the original **H3 Director Studio V1** release.

It remains available for users who prefer or need the earlier single-continuity workflow. V1 is archived: it receives no further fixes or feature work. For current installations and the dual BASE + FINAL Motion Context pipeline, use the repository root and **H3 Director Studio V2**.

## Install V1 separately

1. Copy this entire `H3_Director_Studio_V1` folder into `ComfyUI/custom_nodes/`.
2. Restart ComfyUI.
3. Load [H3_DIRECTOR_STUDIO_V1_PUBLIC.json](workflows/H3_DIRECTOR_STUDIO_V1_PUBLIC.json).

Do not install V1 and V2 under the same custom-node folder. They are separate nodes and can coexist only as separate folders; V2 is the maintained release.

## Contents

- `__init__.py` — archived V1 node backend.
- `web/studio.js` — archived V1 interface.
- `workflows/H3_DIRECTOR_STUDIO_V1_PUBLIC.json` — clean public V1 workflow.

Licensed under the repository MIT license.
