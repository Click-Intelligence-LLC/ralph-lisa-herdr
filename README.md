# Ralph-Lisa Loop — Herdr Plugin

Run Ralph (Claude) and Lisa (Codex) as two seats inside [Herdr](https://herdr.dev), with turn-based handoff (write → review → rework / pass) driven by the Ralph-Lisa Loop CLI.

- Herdr plugin manifest: `integrations/herdr/herdr-plugin.toml` (plugin id `ralph-lisa.loop`, version 0.1.8, requires Herdr ≥ 0.9.4)
- Platforms: macOS
- Status: **alpha** — live acceptance recorded against Herdr 0.9.4; see `docs/herdr/` for design, contracts and acceptance notes.

## Install

From the Herdr plugin marketplace (after it is indexed), or directly:

```bash
herdr plugin install Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr
```

The manifest builds the bundled CLI from `../../cli` (npm ci + npm run build + verify-package) when the plugin is installed, so the repository must keep the `cli/` directory next to `integrations/herdr/`.

## Repository layout

```
integrations/herdr/   Herdr plugin: manifest, actions, panes, coordinator
cli/                  Ralph-Lisa Loop CLI (TypeScript) used by the plugin
docs/herdr/           Public design / contract / acceptance documents
LICENSE               MIT
```

## Provenance and license

This repository packages the Herdr integration developed in the public Ralph-Lisa Loop codebase.

- Upstream: <https://github.com/YW1975/Ralph-Lisa-Loop> (MIT, Copyright (c) 2025 YW1975)
- Source of the imported tree: `yueweilu/Ralph-Lisa-Loop` branch `feat/herdr-auto-task-launch` at commit `d57eb0f` (2026-11-10), which itself is based on the upstream public repository.
- License: MIT — see `LICENSE` and `NOTICE`.

No private keys, tokens or customer data are included. The CLI is not republished to npm from this repository.

## Links

- Herdr plugins: <https://herdr.dev/docs/plugins/>
- Herdr marketplace: <https://herdr.dev/docs/marketplace/>
- Upstream project: <https://github.com/YW1975/Ralph-Lisa-Loop>
