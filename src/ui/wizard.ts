import { homedir } from 'node:os'
import { join } from 'node:path'
import { confirm, isCancel, log, multiselect, note, select, spinner, text } from '@clack/prompts'
import { DEFAULT_BRANCH, DEFAULT_PREFIX, DEFAULT_REPO, SRC_RULES } from '../lib/constants'
import { createContext, type TargetContext } from '../lib/context'
import { type CloneResult, cloneRepo } from '../lib/repo'
import { getAvailableServers, getInstalledServerNames } from '../lib/translators/mcp'
import { discoverLanguages } from '../lib/translators/rules'
import { type Categories, type McpSelection, runSync } from '../sync'
import { BACK, showRestartHint, showSyncSummary } from './common'
import { pickMcpServers } from './mcp-picker'

// ── Wizard state ───────────────────────────────────────────────────────────────

interface WizardState {
  cursorDir?: string
  ctx?: TargetContext
  repoUrl?: string
  prefix?: string
  clone?: CloneResult
  categories?: Categories
  languages?: 'auto' | string[]
  mcpSelection?: McpSelection
}

// ── Step definitions ───────────────────────────────────────────────────────────
// Steps 0-2: pre-clone prompts
// Step 3: clone (automatic, not pushed to history)
// Steps 4-6: post-clone prompts
// Step 7: preview + confirm
// Step 8: sync (automatic, terminal)

const STEP_TARGET_DIR = 0
const STEP_REPO_URL = 1
const STEP_PREFIX = 2
const STEP_CLONE = 3
const STEP_CATEGORIES = 4
const STEP_LANGUAGES = 5
const STEP_MCP = 6
const STEP_CONFIRM = 7
const STEP_SYNC = 8

/**
 * Run the first-time setup wizard.
 * Esc on any step goes back to the previous step.
 * Esc on the first step exits the wizard.
 */
export async function runWizard(): Promise<void> {
  const state: WizardState = {}
  const history: number[] = [] // stack of visited interactive steps
  let step = STEP_TARGET_DIR

  /** Advance to `next`, pushing current step to history. */
  function advance(next: number) {
    history.push(step)
    step = next
  }

  /** Go back to the previous interactive step. Returns false if at the start. */
  function goBack(): boolean {
    if (history.length === 0) {
      return false // at the very beginning — caller decides what to do
    }
    const prev = history.pop()
    if (prev === undefined) return false
    step = prev
    return true
  }

  /** Clean up an active clone when going back past the clone boundary. */
  async function cleanupClone() {
    if (state.clone) {
      await state.clone.cleanup().catch(() => {})
      state.clone = undefined
    }
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  while (step <= STEP_SYNC) {
    switch (step) {
      // ── Step 0: Target directory ─────────────────────────────────────────

      case STEP_TARGET_DIR: {
        const result = await select({
          message: 'Where should ecc2cursor install files?',
          options: [
            {
              value: 'user' as const,
              label: 'User-level (~/.cursor/)',
              hint: 'applies to all projects',
            },
            {
              value: 'project' as const,
              label: 'Current project (./.cursor/)',
              hint: 'project-specific',
            },
            {
              value: 'custom' as const,
              label: 'Custom directory',
              hint: 'specify a path',
            },
          ],
        })

        if (isCancel(result)) {
          return // Esc on first step → return to caller (menu or cli)
        }

        if (result === 'user') {
          state.cursorDir = join(homedir(), '.cursor')
        } else if (result === 'project') {
          state.cursorDir = join(process.cwd(), '.cursor')
        } else {
          const customPath = await text({
            message: 'Enter the .cursor/ directory path:',
            placeholder: join(homedir(), '.cursor'),
            validate: (v) => {
              if (!v?.trim()) return 'Path is required'
            },
          })
          if (isCancel(customPath)) {
            // Esc on custom path sub-prompt → stay on step 0
            break
          }
          state.cursorDir = customPath as string
        }

        state.ctx = createContext(state.cursorDir)
        advance(STEP_REPO_URL)
        break
      }

      // ── Step 1: Repository URL ───────────────────────────────────────────

      case STEP_REPO_URL: {
        const result = await text({
          message: 'Repository URL:',
          placeholder: DEFAULT_REPO,
          defaultValue: DEFAULT_REPO,
        })

        if (isCancel(result)) {
          goBack()
          break
        }

        state.repoUrl = result as string
        advance(STEP_PREFIX)
        break
      }

      // ── Step 2: Prefix ───────────────────────────────────────────────────

      case STEP_PREFIX: {
        const prefixChoice = await select({
          message: 'Add a prefix to file names?',
          options: [
            {
              value: 'default' as const,
              label: `Yes, use "${DEFAULT_PREFIX}" (recommended)`,
              hint: `files named ${DEFAULT_PREFIX}-typescript, ${DEFAULT_PREFIX}-code-reviewer, …`,
            },
            {
              value: 'custom' as const,
              label: 'Yes, custom prefix',
              hint: 'choose your own prefix',
            },
            {
              value: 'none' as const,
              label: 'No prefix',
              hint: "keep original names (auto-detect & clean won't work)",
            },
          ],
        })

        if (isCancel(prefixChoice)) {
          goBack()
          break
        }

        if (prefixChoice === 'default') {
          state.prefix = DEFAULT_PREFIX
        } else if (prefixChoice === 'none') {
          state.prefix = ''
        } else {
          const customPrefix = await text({
            message: 'Enter prefix:',
            placeholder: DEFAULT_PREFIX,
            validate: (v) => {
              if (!v?.trim()) return 'Prefix is required (go back for no prefix)'
              if (!/^[a-z][a-z0-9-]*$/.test(v as string))
                return 'Prefix must be lowercase letters, numbers, and hyphens'
            },
          })

          if (isCancel(customPrefix)) {
            // Esc on custom sub-prompt → stay on this step
            break
          }
          state.prefix = customPrefix as string
        }

        // Next: clone (automatic step, not pushed to history)
        step = STEP_CLONE
        break
      }

      // ── Step 3: Clone (automatic) ────────────────────────────────────────

      case STEP_CLONE: {
        // Clean up any existing clone before re-cloning
        await cleanupClone()

        const s = spinner({ indicator: 'timer' })
        s.start('Cloning repository...')

        try {
          state.clone = await cloneRepo(state.repoUrl as string, DEFAULT_BRANCH)
          s.stop(`Cloned at ${state.clone.sha.slice(0, 8)}`)
          // Advance to categories (clone step is NOT pushed to history)
          step = STEP_CATEGORIES
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          s.error(`Clone failed: ${message}`)
          // Go back to the last interactive step (prefix or repo url)
          if (!goBack()) return
        }
        break
      }

      // ── Step 4: Categories ───────────────────────────────────────────────

      case STEP_CATEGORIES: {
        const result = await multiselect({
          message: 'Which categories to sync?',
          options: [
            { value: 'agents', label: 'Agents', hint: 'Cursor subagents' },
            { value: 'rules', label: 'Rules', hint: 'coding standards per language' },
            { value: 'commands', label: 'Commands', hint: 'thin command wrappers' },
            { value: 'skills', label: 'Skills', hint: 'full skill definitions' },
            { value: 'contexts', label: 'Contexts', hint: 'mode-specific prompts' },
            { value: 'hooks', label: 'Hooks', hint: 'hook intent guidelines' },
            { value: 'mcp', label: 'MCP Servers', hint: 'MCP server installations' },
          ],
          initialValues: ['agents', 'rules', 'commands', 'skills', 'contexts', 'hooks', 'mcp'],
          required: true,
        })

        if (isCancel(result)) {
          // Going back past the clone boundary
          await cleanupClone()
          goBack() // goes to STEP_PREFIX (last interactive pre-clone step)
          break
        }

        const catSet = new Set(result as string[])
        state.categories = {
          agents: catSet.has('agents'),
          rules: catSet.has('rules'),
          commands: catSet.has('commands'),
          skills: catSet.has('skills'),
          contexts: catSet.has('contexts'),
          hooks: catSet.has('hooks'),
          mcp: catSet.has('mcp'),
        }

        // Determine next step (skip languages/mcp if not selected)
        if (state.categories.rules) {
          advance(STEP_LANGUAGES)
        } else if (state.categories.mcp) {
          advance(STEP_MCP)
        } else {
          advance(STEP_CONFIRM)
        }
        break
      }

      // ── Step 5: Languages ────────────────────────────────────────────────

      case STEP_LANGUAGES: {
        const repoDir = (state.clone as CloneResult).repoDir
        const rulesDir = join(repoDir, SRC_RULES)
        const available = await discoverLanguages(rulesDir)

        if (available.length === 0) {
          state.languages = 'auto'
          // Skip to next
          if (state.categories?.mcp) {
            advance(STEP_MCP)
          } else {
            advance(STEP_CONFIRM)
          }
          break
        }

        const result = await multiselect({
          message: 'Which language rule sets?',
          options: available.map((lang) => ({
            value: lang,
            label: lang === 'common' ? 'Common (all languages)' : lang,
          })),
          initialValues: available,
          required: true,
        })

        if (isCancel(result)) {
          goBack()
          break
        }

        state.languages = result as string[]

        if (state.categories?.mcp) {
          advance(STEP_MCP)
        } else {
          advance(STEP_CONFIRM)
        }
        break
      }

      // ── Step 6: MCP servers ──────────────────────────────────────────────

      case STEP_MCP: {
        const available = await getAvailableServers((state.clone as CloneResult).repoDir)

        if (available.length === 0) {
          log.info('No installable MCP servers found in the repository.')
          state.mcpSelection = 'none'
          advance(STEP_CONFIRM)
          break
        }

        const installed = getInstalledServerNames((state.ctx as TargetContext).mcpFile)
        const result = await pickMcpServers(available, installed)

        if (result === BACK) {
          goBack()
          break
        }

        state.mcpSelection = result
        advance(STEP_CONFIRM)
        break
      }

      // ── Step 7: Preview + Confirm ────────────────────────────────────────

      case STEP_CONFIRM: {
        const enabledList = Object.entries(state.categories as Categories)
          .filter(([, v]) => v)
          .map(([k]) => k)

        const langs = state.languages
        const mcp = state.mcpSelection

        const previewLines = [
          `  Target:     ${state.ctx?.cursorDir}`,
          `  Prefix:     ${state.prefix || '(none — original names)'}`,
          `  Repository: ${state.repoUrl}`,
          `  Categories: ${enabledList.join(', ')}`,
          `  Languages:  ${langs === 'auto' || !langs ? 'all' : langs.join(', ')}`,
          `  MCP:        ${!mcp ? 'all' : Array.isArray(mcp) ? mcp.join(', ') : mcp}`,
        ].join('\n')

        note(previewLines, 'Preview')

        const proceed = await confirm({ message: 'Proceed with sync?' })

        if (isCancel(proceed)) {
          goBack()
          break
        }

        if (!proceed) {
          // "No" — go back to let user change settings
          goBack()
          break
        }

        step = STEP_SYNC
        break
      }

      // ── Step 8: Sync (automatic, terminal) ──────────────────────────────

      case STEP_SYNC: {
        try {
          const result = await runSync({
            ctx: state.ctx as TargetContext,
            repoUrl: state.repoUrl as string,
            branch: DEFAULT_BRANCH,
            prefix: state.prefix as string,
            categories: state.categories as Categories,
            languages: state.languages || 'auto',
            mcpSelection: state.mcpSelection || 'all',
            dryRun: false,
          })

          showSyncSummary(result.counts)
          showRestartHint()
        } finally {
          await cleanupClone()
        }

        // Done — exit the loop
        return
      }
    }
  }
}
