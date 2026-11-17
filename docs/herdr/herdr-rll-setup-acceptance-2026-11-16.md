# `herdr-rll setup` acceptance — 2026-11-16

## Scope

This acceptance covers the new CLI 0.3.16 setup command built from branch
`feat/herdr-rll-setup`. It does not claim that CLI 0.3.16 has been published to
npm.

## Automated regression

- Focused setup tests: 5/5 passed.
- Full CLI suite: 531/531 passed.
- Package verification: `ralph-lisa-loop@0.3.16`, 98 release files.
- The package verification used an isolated npm cache because the user's
  default npm cache was not writable in the managed test environment.

Covered setup cases:

1. Install an absent plugin from the fixed public source and ref.
2. Enable an installed but disabled plugin without reinstalling it.
3. Refuse a locally linked plugin with the same id.
4. Preserve and report doctor login/setup requirements.
5. Reject unsupported setup arguments before invoking Herdr.

## Real isolated installation

The real trial used disposable XDG config, state and cache roots under
`/private/tmp/rpub315.AczZA5`. The isolated plugin registry was uninstalled
first, then the locally built CLI 0.3.16 ran:

```bash
node dist/herdr-rll.js setup
```

Observed result:

```json
{
  "schema": 1,
  "status": "ready",
  "herdr_version": "0.9.4",
  "plugin": {
    "id": "ralph-lisa.loop",
    "version": "0.1.9",
    "requested_ref": "v0.1.9",
    "resolved_commit": "a32005abfb9be1ff2f4bd2512c1e225895ca8e63",
    "enabled": true
  },
  "checks": {
    "herdr": { "ok": true, "version": "0.9.4" },
    "rll_cli": { "ok": true, "version": "0.3.15", "host_contract": true },
    "integrations": { "claude": true, "codex": true },
    "login": { "claude": "logged_in", "codex": "logged_in" }
  },
  "code": null
}
```

The installed plugin bundles the already published CLI 0.3.15 host contract;
the outer setup executable is the locally built CLI 0.3.16. This is the
intended compatible mapping for this release.

## Test-harness note

The first isolated invocation inherited `HERDR_ENV`, workspace and socket
variables from the controlling Herdr Pane while also overriding the XDG roots.
That mixed two different Herdr environments and caused the post-install readback
to report `HERDR_PLUGIN_INSTALL_UNVERIFIED`. Re-running as an external-terminal
simulation with those inherited Pane variables removed used one consistent
isolated registry and passed. Normal terminal users do not have this mixed test
environment.

## Packed CLI installation

Before merge, the CLI package was packed from commit `8b12a4c` and installed
into a new isolated npm prefix rather than invoked from the source tree.

- Package: `ralph-lisa-loop-0.3.16.tgz`
- SHA-256: `2f4e70bedea1e7f53536d22cd9d26d4ff49c5bf22a386bda6be77c018f633547`
- Release files: 98
- `ralph-lisa --version`: `ralph-lisa-loop v0.3.16`
- `herdr-rll --help`: included `herdr-rll setup`
- Initial isolated Herdr plugin list: empty

The packed global `herdr-rll setup` command then installed plugin `0.1.9` from
tag `v0.1.9`, resolved commit `a32005abfb9be1ff2f4bd2512c1e225895ca8e63`,
and returned `status=ready` with both Agent integrations and logins ready.

The same packed command was run a second time. It returned `status=ready`
again, while `installed_unix_ms`, `managed_path`, plugin root, requested ref and
resolved commit remained unchanged. This confirms the normal repeated setup
path is idempotent and does not reinstall an already matching plugin.

## Acceptance boundary

Validated:

- local CLI 0.3.16 build;
- packed CLI 0.3.16 installation in an isolated npm prefix;
- fixed public GitHub plugin installation;
- source/ref/readback verification;
- repeated setup without plugin reinstallation;
- real plugin doctor readiness;
- regression and package contents.

Not yet validated:

- npm publication of 0.3.16;
- installation of 0.3.16 from the public npm registry;
- a new full dual-Agent task launched from the published 0.3.16 package.
