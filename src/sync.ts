import { existsSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { TargetContext } from './lib/context'
import { cloneRepo } from './lib/repo'
import { translateAgents } from './lib/translators/agents'
import { translateCommands } from './lib/translators/commands'
import { translateContexts } from './lib/translators/contexts'
import { translateHooks } from './lib/translators/hooks'
import { translateMcp } from './lib/translators/mcp'
import { translateRules } from './lib/translators/rules'
import { translateSkills } from './lib/translators/skills'

// ── Types ──────────────────────────────────────────────────────────────────────

export type McpSelection = 'none' | 'all' | string[]

export interface Categories {
  agents: boolean
  rules: boolean
  commands: boolean
  skills: boolean
  contexts: boolean
  hooks: boolean
  mcp: boolean
}

export const ALL_CATEGORIES: Categories = {
  agents: true,
  rules: true,
  commands: true,
  skills: true,
  contexts: true,
  hooks: true,
  mcp: true,
}

export interface SyncOptions {
  ctx: TargetContext
  repoUrl: string
  branch: string
  prefix: string
  categories: Categories
  languages: 'auto' | string[]
  mcpSelection: McpSelection
  dryRun: boolean
}

export interface SyncResult {
  sha: string
  counts: {
    agents: number
    rules: number
    commands: number
    skills: number
    contexts: number
    hooks: number
    mcp: number
  }
  totalFiles: number
  mcpSelection: McpSelection
}

export interface CleanResult {
  skills: string[]
  agents: string[]
  commands: string[]
  totalRemoved: number
}

// ── Sync ───────────────────────────────────────────────────────────────────────

/**
 * Run the full sync pipeline:
 * 1. Clone repo to temp
 * 2. Run enabled translators
 * 3. Cleanup temp clone
 * 4. Return results
 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { ctx, prefix, categories, languages, dryRun } = options

  const { repoDir, sha, cleanup } = await cloneRepo(options.repoUrl, options.branch)

  try {
    const counts = {
      agents: 0,
      rules: 0,
      commands: 0,
      skills: 0,
      contexts: 0,
      hooks: 0,
      mcp: 0,
    }

    let mcpSelection = options.mcpSelection

    if (categories.agents) {
      const files = await translateAgents(repoDir, ctx, prefix, dryRun)
      counts.agents = files.length
    }

    if (categories.rules) {
      const files = await translateRules(repoDir, ctx, prefix, languages, dryRun)
      counts.rules = files.length
    }

    if (categories.commands) {
      const files = await translateCommands(repoDir, ctx, prefix, dryRun)
      counts.commands = files.length
    }

    if (categories.skills) {
      const files = await translateSkills(repoDir, ctx, prefix, dryRun)
      counts.skills = files.length
    }

    if (categories.contexts) {
      const files = await translateContexts(repoDir, ctx, prefix, dryRun)
      counts.contexts = files.length
    }

    if (categories.hooks) {
      const files = await translateHooks(repoDir, ctx, prefix, dryRun)
      counts.hooks = files.length
    }

    if (categories.mcp) {
      const result = await translateMcp(repoDir, ctx, dryRun, mcpSelection)
      counts.mcp = result.added
      mcpSelection = result.updatedSelection
    }

    const totalFiles = Object.values(counts).reduce((a, b) => a + b, 0)

    return { sha, counts, totalFiles, mcpSelection }
  } finally {
    await cleanup()
  }
}

// ── Clean ──────────────────────────────────────────────────────────────────────

/**
 * Remove all files/dirs matching the prefix from the target context.
 * Stateless: scans for prefix-matched items instead of using a manifest.
 *
 * MCP servers are NOT removed — users may have configured them independently.
 * A hint is shown to the caller so they can inform the user.
 *
 * When prefix is empty, clean is a no-op (can't distinguish installed
 * files from user-created ones without a prefix).
 */
export async function runClean(ctx: TargetContext, prefix: string): Promise<CleanResult> {
  const result: CleanResult = {
    skills: [],
    agents: [],
    commands: [],
    totalRemoved: 0,
  }

  if (!prefix) return result

  const prefixPattern = `${prefix}-`

  // 1. Remove prefix-matched skill directories
  if (existsSync(ctx.skillsDir)) {
    const dirs = readdirSync(ctx.skillsDir).filter((d) => d.startsWith(prefixPattern))
    for (const dir of dirs) {
      await rm(join(ctx.skillsDir, dir), { recursive: true, force: true })
      result.skills.push(dir)
    }
  }

  // 2. Remove prefix-matched agent files
  if (existsSync(ctx.agentsDir)) {
    const files = readdirSync(ctx.agentsDir).filter((f) => f.startsWith(prefixPattern))
    for (const file of files) {
      await rm(join(ctx.agentsDir, file), { force: true })
      result.agents.push(file)
    }
  }

  // 3. Remove prefix-matched command files
  if (existsSync(ctx.commandsDir)) {
    const files = readdirSync(ctx.commandsDir).filter((f) => f.startsWith(prefixPattern))
    for (const file of files) {
      await rm(join(ctx.commandsDir, file), { force: true })
      result.commands.push(file)
    }
  }

  result.totalRemoved = result.skills.length + result.agents.length + result.commands.length

  return result
}
