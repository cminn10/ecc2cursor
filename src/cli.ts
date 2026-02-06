import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_BRANCH, DEFAULT_PREFIX, DEFAULT_REPO } from './lib/constants'
import { createContext } from './lib/context'
import { isTTY, runPreflight } from './lib/preflight'
import { formatScanResult, scanAll, scanDirectory } from './lib/scanner'
import { ALL_CATEGORIES, runClean, runSync } from './sync'
import { showIntro, showOutro, VERSION } from './ui/common'
import { runMenu } from './ui/menu'
import { runWizard } from './ui/wizard'

// ── CLI argument parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--'))
const flags = new Set(args.filter((a) => a.startsWith('--')))

function getFlag(name: string): string | undefined {
  const flag = args.find((a) => a.startsWith(`--${name}=`))
  return flag?.split('=')[1]
}

const dryRun = flags.has('--dry-run')
const noPrefix = flags.has('--no-prefix')
const targetDir = getFlag('dir')
const prefix = noPrefix ? '' : (getFlag('prefix') ?? DEFAULT_PREFIX)

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  await runPreflight()

  // Non-interactive subcommands
  if (command) {
    switch (command) {
      case 'sync':
        await cmdSync()
        break
      case 'status':
        cmdStatus()
        break
      case 'clean':
        await cmdClean()
        break
      case 'help':
        printUsage()
        break
      default:
        printUsage()
        process.exit(1)
    }
    return
  }

  // Interactive mode: TTY guard
  if (!isTTY()) {
    printUsage()
    process.exit(0)
  }

  // Interactive mode: scan for existing installations
  showIntro()

  const scanResults = scanAll(prefix)

  if (scanResults.length === 0) {
    // First run → wizard
    await runWizard()
  } else {
    // Returning user → menu
    await runMenu(scanResults, prefix)
  }

  showOutro()
}

function printUsage() {
  console.log(`
ecc2cursor v${VERSION} — Sync Everything Claude Code configs into Cursor

Usage:
  ecc2cursor                     Interactive mode (wizard or menu)
  ecc2cursor sync [flags]        Sync with defaults
  ecc2cursor status [flags]      Show installed files
  ecc2cursor clean [flags]       Remove installed files

Flags:
  --dir=PATH     Target .cursor/ directory (default: ~/.cursor)
  --prefix=NAME  File prefix (default: ecc)
  --no-prefix    Use original file names without a prefix
  --dry-run      Preview changes without writing files
`)
}

// ── Non-interactive subcommands ────────────────────────────────────────────────

async function cmdSync() {
  const dir = targetDir || join(homedir(), '.cursor')
  const ctx = createContext(dir)

  if (dryRun) console.log('DRY RUN — no files will be written.\n')

  console.log(`Target: ${ctx.cursorDir}`)
  console.log('Cloning repository...\n')

  const result = await runSync({
    ctx,
    repoUrl: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    prefix,
    categories: ALL_CATEGORIES,
    languages: 'auto',
    mcpSelection: 'all',
    dryRun,
  })

  console.log(`At commit ${result.sha.slice(0, 8)}\n`)

  console.log('Summary:')
  console.log(`  ${result.counts.agents} subagent(s)`)
  console.log(`  ${result.counts.rules} rule file(s)`)
  console.log(`  ${result.counts.commands} command(s)`)
  console.log(`  ${result.counts.skills} skill(s)`)
  console.log(`  ${result.counts.contexts} context(s)`)
  console.log(`  ${result.counts.hooks} hook rule(s)`)
  console.log(`  ${result.counts.mcp} MCP server(s)`)
  console.log(`  ${result.totalFiles} total`)

  if (dryRun) {
    console.log('\nDry run complete. No files were written.')
  } else {
    console.log('\nSync complete! Restart Cursor to pick up changes.')
  }
}

function cmdStatus() {
  const dir = targetDir || join(homedir(), '.cursor')
  const prefixLabel = prefix ? `prefix: ${prefix}` : 'no prefix'

  if (!prefix) {
    console.log(`ecc2cursor status (${prefixLabel})\n`)
    console.log('  Cannot detect installed files without a prefix.')
    console.log('  Use --prefix=NAME to scan for a specific prefix.')
    return
  }

  if (targetDir) {
    // Scan specific directory
    const result = scanDirectory(dir, prefix)
    console.log(`ecc2cursor status (${prefixLabel})\n`)
    if (result.totalFiles === 0) {
      console.log(`  No ${prefix}-* files found in ${dir}`)
    } else {
      console.log(`  ${formatScanResult(result)}`)
      if (result.skills.length > 0) console.log(`    Skills: ${result.skills.join(', ')}`)
      if (result.agents.length > 0) console.log(`    Agents: ${result.agents.join(', ')}`)
      if (result.commands.length > 0) console.log(`    Commands: ${result.commands.join(', ')}`)
    }
  } else {
    // Scan all known locations
    const results = scanAll(prefix)
    console.log(`ecc2cursor status (${prefixLabel})\n`)

    if (results.length === 0) {
      console.log(`  No ${prefix}-* files found.`)
      console.log('  Run `ecc2cursor sync` to get started.')
      return
    }

    for (const result of results) {
      console.log(`  ${formatScanResult(result)}`)
      if (result.skills.length > 0) console.log(`    Skills: ${result.skills.join(', ')}`)
      if (result.agents.length > 0) console.log(`    Agents: ${result.agents.join(', ')}`)
      if (result.commands.length > 0) console.log(`    Commands: ${result.commands.join(', ')}`)
      console.log('')
    }
  }
}

async function cmdClean() {
  const dir = targetDir || join(homedir(), '.cursor')
  const ctx = createContext(dir)

  if (!prefix) {
    console.log("Cannot clean without a prefix (can't distinguish installed files).")
    console.log('Use --prefix=NAME to specify which files to remove.')
    return
  }

  console.log(`Cleaning all ${prefix}-* files from ${ctx.cursorDir}...\n`)

  const result = await runClean(ctx, prefix)

  if (result.totalRemoved === 0) {
    console.log('  No files to remove.')
  } else {
    if (result.skills.length > 0) {
      console.log(`  Removed ${result.skills.length} skill dir(s):`)
      for (const s of result.skills) console.log(`    - ${s}`)
    }
    if (result.agents.length > 0) {
      console.log(`  Removed ${result.agents.length} agent file(s):`)
      for (const a of result.agents) console.log(`    - ${a}`)
    }
    if (result.commands.length > 0) {
      console.log(`  Removed ${result.commands.length} command file(s):`)
      for (const c of result.commands) console.log(`    - ${c}`)
    }
  }

  console.log('\nClean complete.')
  console.log('Note: MCP servers were not removed. Edit .cursor/mcp.json manually if needed.')
}

// ── Run ────────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
