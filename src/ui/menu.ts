import { homedir } from 'node:os'
import { join } from 'node:path'
import { confirm, isCancel, log, select, spinner } from '@clack/prompts'
import { DEFAULT_BRANCH, DEFAULT_PREFIX, DEFAULT_REPO } from '../lib/constants'
import { createContext } from '../lib/context'
import { cloneRepo } from '../lib/repo'
import { formatScanResult, type ScanResult, scanAll } from '../lib/scanner'
import { getAvailableServers, getInstalledServerNames } from '../lib/translators/mcp'
import { ALL_CATEGORIES, runClean, runSync } from '../sync'
import { BACK, showCleanSummary, showRestartHint, showSyncSummary } from './common'
import { pickMcpServers } from './mcp-picker'
import { runWizard } from './wizard'

/**
 * Show the returning user menu.
 * Loops until the user explicitly chooses to exit.
 */
export async function runMenu(
  initialScanResults: ScanResult[],
  prefix: string = DEFAULT_PREFIX
): Promise<void> {
  let scanResults = initialScanResults

  while (true) {
    // Build menu options dynamically based on scan results
    const options: { value: string; label: string; hint?: string }[] = []

    for (const result of scanResults) {
      const shortPath =
        result.cursorDir === join(homedir(), '.cursor')
          ? '~/.cursor/'
          : `${result.cursorDir.replace(homedir(), '~')}/`
      options.push({
        value: `resync:${result.cursorDir}`,
        label: `Re-sync ${shortPath}`,
        hint: `${result.totalFiles} files`,
      })
    }

    const cleanLabel = prefix ? `Clean all ${prefix}-* files` : 'Clean installed files'

    options.push(
      { value: 'new', label: 'Setup new directory', hint: 'run the wizard' },
      { value: 'mcp', label: 'Manage MCP servers', hint: 'add or remove' },
      { value: 'status', label: 'Status', hint: 'detailed file list' },
      { value: 'clean', label: cleanLabel, hint: 'remove everything' },
      { value: 'exit', label: 'Exit' }
    )

    const choice = await select({
      message: 'What would you like to do?',
      options,
    })

    if (isCancel(choice) || choice === 'exit') {
      return
    }

    const action = choice as string

    if (action === 'new') {
      await runWizard()
      // Refresh scan results (wizard may have installed files)
      scanResults = scanAll(prefix)
      if (scanResults.length === 0) scanResults = initialScanResults
    } else if (action === 'status') {
      showDetailedStatus(scanResults, prefix)
    } else if (action === 'clean') {
      await menuClean(scanResults, prefix)
      // Refresh scan results after clean
      scanResults = scanAll(prefix)
    } else if (action === 'mcp') {
      await menuMcp(scanResults[0], prefix)
    } else if (action.startsWith('resync:')) {
      const cursorDir = action.slice('resync:'.length)
      await menuResync(cursorDir, prefix)
      // Refresh scan results after re-sync
      scanResults = scanAll(prefix)
      if (scanResults.length === 0) scanResults = initialScanResults
    }

    // After any operation, ask what next
    const next = await select({
      message: 'What next?',
      options: [
        { value: 'menu', label: 'Back to main menu' },
        { value: 'exit', label: 'Exit' },
      ],
    })

    if (isCancel(next) || next === 'exit') {
      return
    }

    // Loop back to main menu
  }
}

// ── Sub-operations ─────────────────────────────────────────────────────────────

async function menuResync(cursorDir: string, prefix: string): Promise<void> {
  const ctx = createContext(cursorDir)

  log.step(`Re-syncing ${ctx.cursorDir}...`)

  const result = await runSync({
    ctx,
    repoUrl: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    prefix,
    categories: ALL_CATEGORIES,
    languages: 'auto',
    mcpSelection: 'all',
    dryRun: false,
  })

  showSyncSummary(result.counts)
  showRestartHint()
}

async function menuClean(scanResults: ScanResult[], prefix: string): Promise<void> {
  const total = scanResults.reduce((sum, r) => sum + r.totalFiles, 0)

  const ok = await confirm({
    message: `Remove all ${total} ${prefix}-* files? (MCP servers are kept)`,
  })

  if (isCancel(ok) || !ok) {
    log.info('Clean cancelled.')
    return
  }

  for (const scan of scanResults) {
    const ctx = createContext(scan.cursorDir)
    log.step(`Cleaning ${scan.cursorDir}...`)
    const result = await runClean(ctx, prefix)
    showCleanSummary(result)
  }
}

async function menuMcp(scan: ScanResult, _prefix: string): Promise<void> {
  const ctx = createContext(scan.cursorDir)
  const installed = getInstalledServerNames(ctx.mcpFile)

  const s = spinner({ indicator: 'timer' })
  s.start('Discovering MCP servers...')

  const { repoDir, cleanup } = await cloneRepo(DEFAULT_REPO, DEFAULT_BRANCH)

  try {
    const available = await getAvailableServers(repoDir)
    s.stop(`Found ${available.length} token-free servers`)

    if (available.length === 0) {
      log.info('No installable MCP servers found.')
      return
    }

    const selection = await pickMcpServers(available, installed)

    if (selection === BACK || selection === 'none') {
      return
    }

    // Install by running just the MCP translator
    const { translateMcp } = await import('../lib/translators/mcp')
    const result = await translateMcp(repoDir, ctx, false, selection)

    log.success(`MCP: ${result.added} added, ${result.skipped} already present`)
  } finally {
    await cleanup()
  }
}

function showDetailedStatus(scanResults: ScanResult[], _prefix: string): void {
  for (const result of scanResults) {
    log.step(formatScanResult(result))

    if (result.skills.length > 0) {
      log.info(`  Skills:\n    ${result.skills.join('\n    ')}`)
    }
    if (result.agents.length > 0) {
      log.info(`  Agents:\n    ${result.agents.join('\n    ')}`)
    }
    if (result.commands.length > 0) {
      log.info(`  Commands:\n    ${result.commands.join('\n    ')}`)
    }
  }
}
