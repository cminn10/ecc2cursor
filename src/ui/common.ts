import { cancel, intro, log, note, outro } from '@clack/prompts'

declare const __VERSION__: string
export const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev'

/**
 * Sentinel value returned by wizard steps when the user presses Esc.
 * The wizard loop interprets this as "go back to the previous step".
 */
export const BACK = Symbol('back')

/**
 * Display the welcome banner.
 */
export function showIntro(): void {
  intro(`ecc2cursor v${VERSION}`)
}

/**
 * Display the goodbye message.
 */
export function showOutro(message = 'Done!'): void {
  outro(message)
}

/**
 * Show a restart hint after syncing.
 */
export function showRestartHint(): void {
  note('Restart Cursor to pick up the new skills, agents, and commands.', 'Next step')
}

/**
 * Show a summary of sync results as a bordered note.
 */
export function showSyncSummary(counts: {
  agents: number
  rules: number
  commands: number
  skills: number
  contexts: number
  hooks: number
  mcp: number
}): void {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const lines = [
    `  Agents:    ${counts.agents}`,
    `  Rules:     ${counts.rules}`,
    `  Commands:  ${counts.commands}`,
    `  Skills:    ${counts.skills}`,
    `  Contexts:  ${counts.contexts}`,
    `  Hooks:     ${counts.hooks}`,
    `  MCP:       ${counts.mcp}`,
    '  ─────────────',
    `  Total:     ${total}`,
  ].join('\n')

  note(lines, 'Sync complete')
}

/**
 * Show a summary of clean results.
 */
export function showCleanSummary(result: {
  skills: string[]
  agents: string[]
  commands: string[]
  totalRemoved: number
}): void {
  if (result.totalRemoved === 0) {
    log.info('No prefixed files found to remove.')
    return
  }

  const lines: string[] = []
  if (result.skills.length > 0) lines.push(`  Skills removed:   ${result.skills.length}`)
  if (result.agents.length > 0) lines.push(`  Agents removed:   ${result.agents.length}`)
  if (result.commands.length > 0) lines.push(`  Commands removed: ${result.commands.length}`)
  lines.push('  ─────────────────')
  lines.push(`  Total removed:    ${result.totalRemoved}`)

  note(lines.join('\n'), 'Clean complete')
  log.info('MCP servers were not removed. Edit .cursor/mcp.json manually if needed.')
}

/**
 * Handle user cancellation gracefully (hard exit).
 */
export function handleCancel(): never {
  cancel('Operation cancelled.')
  process.exit(0)
}
