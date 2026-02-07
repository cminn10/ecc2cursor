# ecc2cursor

[![npm version](https://img.shields.io/npm/v/ecc2cursor)](https://www.npmjs.com/package/ecc2cursor)
[![license](https://img.shields.io/npm/l/ecc2cursor)](./LICENSE)
[![node](https://img.shields.io/node/v/ecc2cursor)](https://nodejs.org)

> Bring battle-tested **Cursor rules**, **skills**, **agents**, **commands**, and **MCP servers** from [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) into your Cursor IDE setup — with a single command.

**Zero config. Fully stateless.** No hidden files, no persistent state. Just run it.

## Why ecc2cursor?

[Everything Claude Code](https://github.com/affaan-m/everything-claude-code) (ECC) is a curated collection of AI coding configurations — rules for dozens of languages, reusable skills, specialized agents, and pre-configured MCP servers. It's built for Claude Code, but the patterns are universal.

**ecc2cursor** automatically translates and installs these configs into Cursor's format:

- **Cursor Rules** — coding standards for TypeScript, Python, Go, Java, Django, Spring Boot, and more
- **Cursor Skills** — reusable prompt-driven workflows (TDD, code review, security audit, planning, etc.)
- **Cursor Agents** — specialized subagents for build errors, refactoring, database review, E2E tests
- **Cursor Commands** — one-click actions for common workflows
- **MCP Servers** — pre-configured Model Context Protocol integrations

No manual copying. No format mismatches. Just `npx ecc2cursor` and pick what you need.

## Quick Start

<!-- TODO: Add terminal recording GIF here (e.g. via asciinema or charmbracelet/vhs) -->

```bash
# npm
npx ecc2cursor

# bun
bunx ecc2cursor
```

This launches an interactive wizard that walks you through:

1. Picking a target directory (`~/.cursor/` or project-level)
2. Choosing which categories to sync (agents, rules, commands, skills, contexts, hooks, MCP)
3. Selecting language rule sets
4. Picking MCP servers to install
5. Confirming and syncing

## Non-Interactive Mode

```bash
# Sync everything with defaults to ~/.cursor/
npx ecc2cursor sync        # or: bunx ecc2cursor sync

# Sync to a specific directory
npx ecc2cursor sync --dir=./my-project/.cursor

# Preview what would be synced
npx ecc2cursor sync --dry-run

# Check what's installed
npx ecc2cursor status

# Remove all ecc-* files
npx ecc2cursor clean

# Sync without a prefix (use original file names)
npx ecc2cursor sync --no-prefix
```

> **Tip:** All `npx` commands work with `bunx` too — just swap the prefix.

## How It Works

ecc2cursor is **fully stateless** — it saves nothing to your machine beyond the synced files themselves.

1. **Clone**: Shallow-clones the ECC repo to a temp directory (2-3 seconds)
2. **Translate**: Converts Claude Code configs to Cursor-compatible formats
3. **Install**: Writes files to your `.cursor/` directory (with an optional prefix)
4. **Cleanup**: Deletes the temp clone

### Prefix and Detection

By default, files are named with an `ecc-` prefix (e.g., `ecc-typescript`, `ecc-code-reviewer.md`). The prefix **is** the manifest — ecc2cursor scans for prefixed files to detect what's already installed.

You can choose **no prefix** during the wizard or via `--no-prefix` to keep original file names. Note that without a prefix, auto-detection and prefix-based clean won't work — the wizard will run each time, and clean will only remove MCP servers.

### What Gets Synced

| Source | Target (with prefix `ecc`) | Description |
|--------|--------|-------------|
| `agents/*.md` | `.cursor/agents/ecc-*.md` | Cursor subagents |
| `rules/<lang>/*.md` | `.cursor/skills/ecc-<lang>/` | Coding standards per language |
| `commands/*.md` | `.cursor/skills/ecc-*/SKILL.md` + `.cursor/commands/ecc-*.md` | Full skills + thin command wrappers |
| `skills/*/SKILL.md` | `.cursor/skills/ecc-*/SKILL.md` | Pass-through skill definitions |
| `contexts/*.md` | `.cursor/skills/ecc-ctx-*/SKILL.md` | Mode-specific context prompts |
| `hooks/hooks.json` | `.cursor/skills/ecc-coding-standards/rules/*.md` | Hook intent guidelines |
| `mcp-configs/` | `.cursor/mcp.json` | MCP server installations (no prefix) |

> With `--no-prefix`, the `ecc-` portion is omitted (e.g., `agents/code-reviewer.md`, `skills/typescript/`).

### Content Transforms

All synced content is automatically adapted:

- Path references (`~/.claude/` → `~/.cursor/`)
- Agent references (→ skill references with `ecc-` prefix)
- Command references (→ `ecc-` prefixed commands)
- Tool names (`Bash` → `Shell`, `Edit` → `StrReplace`)
- Claude Code terminology (→ Cursor)

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--dir=PATH` | Target `.cursor/` directory | `~/.cursor` |
| `--prefix=NAME` | File prefix for all synced items | `ecc` |
| `--no-prefix` | Use original file names without a prefix | - |
| `--dry-run` | Preview changes without writing | - |

## Requirements

- **Node.js >= 20** or **Bun**
- **Git** (for cloning the source repository)

## Related Projects

- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) — the source collection of AI coding configs this tool syncs from
- [Cursor IDE](https://cursor.com) — the AI-first code editor these configs target
- [Model Context Protocol](https://modelcontextprotocol.io) — the open standard for MCP servers synced by this tool

## Contributing

Found a bug? Want to add a new translator? PRs and issues welcome. See the [ECC repository](https://github.com/affaan-m/everything-claude-code) for the upstream config source.

## License

MIT
