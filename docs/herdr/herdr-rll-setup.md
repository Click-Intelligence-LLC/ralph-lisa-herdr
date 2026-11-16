# `herdr-rll setup`

## Purpose

`herdr-rll setup` is the public installation bridge between the npm CLI and the
Herdr plugin. It gives users one product-level command instead of requiring them
to remember the repository, subdirectory and plugin tag.

```bash
npm install -g ralph-lisa-loop@0.3.16
herdr-rll setup
```

The npm installation provides the `herdr-rll` executable. The setup command
then installs and verifies the separately managed Herdr plugin.

## Fixed release mapping

CLI 0.3.16 installs this public plugin source:

```text
source: Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr
ref:    v0.1.9
id:     ralph-lisa.loop
```

The source and ref are fixed in the CLI release. Users cannot redirect `setup`
to an arbitrary repository. Manual Herdr installation remains available when a
different ref is intentionally required.

## Setup flow

1. Run `herdr --version` and require Herdr 0.9.4 or later.
2. Read the current global Herdr plugin registry.
3. Refuse an existing `ralph-lisa.loop` registration from a local link or a
   different GitHub source.
4. Install the fixed public source and tag when the plugin is absent or older.
5. Enable an installed plugin when it is disabled.
6. Read back the registry and verify plugin id, source, version and enabled
   state.
7. Execute the installed plugin's declared `doctor` command from its managed
   plugin root.
8. Return one JSON result describing the plugin version and doctor checks.

Setup does not start Ralph or Lisa, initialize a project, answer Agent prompts,
or modify an existing RLL session.

## Successful result

```json
{
  "schema": 1,
  "status": "ready",
  "herdr_version": "0.9.4",
  "plugin": {
    "id": "ralph-lisa.loop",
    "version": "0.1.9",
    "requested_ref": "v0.1.9",
    "resolved_commit": "...",
    "enabled": true
  },
  "checks": {
    "herdr": { "ok": true },
    "rll_cli": { "ok": true },
    "integrations": { "claude": true, "codex": true },
    "login": { "claude": "logged_in", "codex": "logged_in" }
  },
  "code": null
}
```

Exit code `0` means setup and doctor are ready. Exit code `3` means the plugin
is installed but doctor still requires an external step such as Agent login.
Invalid arguments or a refused installation return exit code `2` with a stable
error code on stderr.

## Safety and conflict handling

- The command passes `--yes` only for the hard-coded company repository and
  release tag.
- It does not use npm `postinstall`, so installing or upgrading the npm package
  never changes Herdr without the explicit `herdr-rll setup` command.
- It refuses to overwrite a locally linked development plugin.
- It refuses the same plugin id when registered from another source.
- It accepts a newer plugin from the official source rather than downgrading it.
- It runs the doctor command declared by the verified installed plugin instead
  of duplicating the plugin's login and integration rules.

## Manual equivalent

```bash
herdr plugin install \
  Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr \
  --ref v0.1.9

herdr plugin action invoke ralph-lisa.loop.doctor
```

Use the manual path for debugging, local plugin development or explicit ref
testing. Normal users should use `herdr-rll setup`.
