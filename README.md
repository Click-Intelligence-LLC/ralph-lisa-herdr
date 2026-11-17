# Ralph-Lisa Loop — Herdr Plugin

Run Ralph (Claude) and Lisa (Codex) as two seats inside [Herdr](https://herdr.dev), with turn-based handoff (write → review → rework / pass) driven by the Ralph-Lisa Loop CLI.

- Herdr plugin manifest: `integrations/herdr/herdr-plugin.toml` (plugin id `ralph-lisa.loop`, version 0.1.9, requires Herdr ≥ 0.9.4)
- Platforms: macOS
- Status: **alpha** — live acceptance recorded against Herdr 0.9.4; see `docs/herdr/` for design, contracts and acceptance notes.

## Install

CLI 0.3.16 and later can install and verify the matching public Herdr plugin:

```bash
npm install -g ralph-lisa-loop@0.3.16
herdr-rll setup
```

`herdr-rll setup` checks Herdr 0.9.4 or later, installs the official plugin from
`Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr` at tag `v0.1.9`,
enables it when necessary, and runs the plugin's doctor. It refuses to replace
a local development link or another source registered as `ralph-lisa.loop`.

The equivalent manual plugin command remains available for inspection and recovery:

```bash
herdr plugin install Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr --ref v0.1.9
```

After setup, start a task from an empty project:

```bash
mkdir my-project && cd my-project
herdr-rll --full-auto "Create a responsive website and run its build"
```

The manifest builds the bundled CLI from `../../cli` (npm ci + npm run build + verify-package) when the plugin is installed, so the repository must keep the `cli/` directory next to `integrations/herdr/`.

The terminal command and the Herdr **Start Ralph-Lisa task** overlay launch the same RLL workflow. Run a new task in an empty project directory. `--full-auto` selects the Agent permission profile; eligible candidates are committed automatically for that session, but their source is recorded as `unverified`. Claude may still ask you to trust a new directory. Use `herdr-rll status` to inspect an existing launch instead of starting it again.

One Herdr Server can host multiple projects concurrently. Each new RLL session gets its own Ralph and Lisa Agent targets, so keeping one project's Agent panes open no longer blocks another project from starting. A project still permits only one RLL session at a time; use `herdr-rll status` or the explicit recovery flow instead of starting the same project twice.

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

No private keys, tokens or customer data are included. The CLI package retains the upstream MIT license and copyright notice. CLI releases from this repository use the existing `ralph-lisa-loop` npm package name and require its npm maintainer to publish them.

## Links

- Herdr plugins: <https://herdr.dev/docs/plugins/>
- Herdr marketplace: <https://herdr.dev/docs/marketplace/>
- Upstream project: <https://github.com/YW1975/Ralph-Lisa-Loop>
