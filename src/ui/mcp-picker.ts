import { isCancel, log, multiselect, note } from '@clack/prompts'
import type { AvailableServer } from '../lib/translators/mcp'
import type { McpSelection } from '../sync'
import { BACK } from './common'

/**
 * Interactively prompt user to select which MCP servers to install.
 *
 * - Already-installed servers are shown as a note and excluded from selection.
 * - All not-yet-installed servers are pre-checked.
 * - User deselects ones they don't want.
 * - Esc returns BACK (caller handles going to previous step).
 */
export async function pickMcpServers(
  available: AvailableServer[],
  installed: Set<string>
): Promise<McpSelection | typeof BACK> {
  if (available.length === 0) {
    log.info('No installable MCP servers found in the repository.')
    return 'none'
  }

  // Partition into installed and not-installed
  const alreadyInstalled = available.filter((s) => installed.has(s.name))
  const notInstalled = available.filter((s) => !installed.has(s.name))

  // Show what's already installed
  if (alreadyInstalled.length > 0) {
    note(
      alreadyInstalled.map((s) => `  ${s.name}`).join('\n'),
      `Already installed (${alreadyInstalled.length})`
    )
  }

  // If all are installed, nothing to do
  if (notInstalled.length === 0) {
    log.success('All available MCP servers are already installed.')
    return 'none'
  }

  // Multiselect from not-yet-installed servers, all pre-checked
  const selected = await multiselect({
    message: `Select MCP servers to install (${notInstalled.length} available):`,
    options: notInstalled.map((s) => ({
      value: s.name,
      label: s.name,
      hint: s.description || undefined,
    })),
    initialValues: notInstalled.map((s) => s.name),
    required: false,
  })

  if (isCancel(selected)) return BACK

  const sel = selected as string[]

  if (sel.length === 0) return 'none'

  // "all" means all available (installed + newly selected)
  if (sel.length === notInstalled.length && alreadyInstalled.length === 0) {
    return 'all'
  }

  return sel
}
