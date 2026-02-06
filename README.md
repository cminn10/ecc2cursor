# ecc2cursor

Sync [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) configs into Cursor — skills, agents, commands, and MCP servers.

**Zero config. Fully stateless.** No hidden files, no persistent state. Just run it.

## Quick Start

```bash
npx ecc2cursor
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
npx ecc2cursor sync

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

- **Node.js >= 20**
- **Git** (for cloning the source repository)

## License

MIT
