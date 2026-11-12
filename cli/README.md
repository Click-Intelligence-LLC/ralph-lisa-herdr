# Ralph-Lisa Loop

<p align="center">
  <img src="https://raw.githubusercontent.com/YW1975/Ralph-Lisa-Loop/main/rll_cat.png" alt="Ralph-Lisa Loop" width="256" />
</p>

Turn-based dual-agent collaboration: Ralph codes, Lisa reviews, consensus required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/ralph-lisa-loop.svg)](https://www.npmjs.com/package/ralph-lisa-loop)

## Quick Start

```bash
npm i -g ralph-lisa-loop
cd your-project
ralph-lisa init
ralph-lisa start "implement login feature"
```

## Herdr entry point (macOS)

Install Herdr 0.9.4 or later and the [Ralph-Lisa Herdr plugin](https://github.com/Click-Intelligence-LLC/ralph-lisa-herdr), then install this CLI package:

```bash
herdr plugin install Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr
npm install -g ralph-lisa-loop@0.3.14
mkdir my-project && cd my-project
herdr-rll --full-auto "Create a responsive website and run its build"
herdr-rll status
```

You can also start from the plugin's task input page in Herdr. Installing the plugin does not register the global `herdr-rll` command. Each new task needs an empty project; use `herdr-rll status` to inspect an existing session. `--full-auto` configures Agent permissions, while eligible candidates are automatically committed for that session with `source_verification=unverified`. Claude can still request directory trust.

## How It Works

```
Ralph writes → Lisa reviews → Consensus → Next step
     ↑                                        |
     └────────────────────────────────────────┘
```

- **Ralph** (Claude Code): Lead developer — researches, plans, codes, tests
- **Lisa** (Codex): Code reviewer — reviews diffs, checks edge cases
- **You**: Tech lead — architecture, scope, tiebreaking

## Key Features

- **Turn Control** — Only one agent works at a time; submissions pass the turn automatically
- **Tag System** — `[PLAN]`, `[CODE]`, `[FIX]`, `[PASS]`, `[NEEDS_WORK]`, `[CHALLENGE]`, `[CONSENSUS]`
- **Consensus Protocol** — Both agents must agree before proceeding; advisory verdicts, not commands
- **Policy Layer** — Configurable `warn`/`block` mode for submission quality checks
- **Auto Mode** — tmux-based automation with file watcher for hands-off operation
- **Round 1 Mandatory Plan** — Ralph must submit `[PLAN]` first for Lisa to verify understanding
- **Goal Guardian** — Lisa checks for direction drift before every review
- **Mid-Session Task Update** — Change direction without restarting
- **Deadlock Detection** — After 8 consecutive `[NEEDS_WORK]` rounds, watcher auto-pauses for user intervention
- **Minimal Init** — Zero-intrusion mode with plugin/global config architecture

## Essential Commands

```bash
# Setup
ralph-lisa init [dir]                    # Initialize project
ralph-lisa start "task"                  # Launch both agents
ralph-lisa auto "task"                   # Auto mode (tmux)

# Turn control
ralph-lisa whose-turn                    # Check whose turn
ralph-lisa submit-ralph --file f.md      # Ralph submits
ralph-lisa submit-lisa --file f.md       # Lisa submits

# Information
ralph-lisa status                        # Current status
ralph-lisa host inspect --project /absolute/path --json  # Read-only host project check
ralph-lisa read work.md                  # Ralph's latest
ralph-lisa read review.md                # Lisa's latest
ralph-lisa history                       # Full history

# Flow control
ralph-lisa step "phase-name"             # Enter new step
ralph-lisa update-task "new direction"   # Change task mid-session

# Diagnostics
ralph-lisa doctor                        # Check dependencies

# Testing
ralph-lisa test-report                   # View latest test report
ralph-lisa test-report --list            # List all test reports
```

The Herdr host contract supports session-scoped automatic commits for new sessions started through `herdr-rll`, `auto --host herdr`, or the plugin task input page. Manual sessions still require a matching `host confirm-candidate` assertion before `host commit`. Both paths record source verification as `unverified`; this is not independent Agent attribution. See the [Herdr plugin documentation](../integrations/herdr/README.md) for current behavior and limits.
After a process crash leaves `.rll-host-command-lock`, use `host command-lock-check`
and, only after verifying that the owner and its child processes stopped,
`host retire-command-lock` with the returned evidence. Then inspect `host receipt`
and `host snapshot`; retiring the lock never replays a submission.

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://claude.ai/code) — for Ralph
- [Codex CLI](https://github.com/openai/codex) — for Lisa
- tmux — for auto mode (`brew install tmux` / `apt install tmux`)

## Develop the CLI

From a repository checkout, use the committed lockfile for repeatable installs:

```bash
cd cli
npm ci
npm run build
npm test
```

The CLI supports Node.js 18 or newer. CI checks Node.js 18, 20, and 22.

## Documentation

Full documentation on GitHub:

- **[User Guide](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/guide.md)** — Setup, workflows, configuration
- **[Command Reference](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/reference.md)** — All CLI commands
- **[FAQ](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/faq.md)** — Common questions and troubleshooting
- **[Changelog](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/changelog.md)** — Version history
- **[Design Philosophy](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/CONCEPT.md)** — Why dual-agent works

Other languages: [日本語](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/ja/guide.md) | [中文](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/zh-CN/guide.md)

## License

[MIT](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/LICENSE)
