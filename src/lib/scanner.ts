import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createContext } from './context'

/**
 * Result of scanning a .cursor/ directory for prefixed content.
 */
export interface ScanResult {
  /** The .cursor directory that was scanned */
  cursorDir: string
  /** Prefixed skill directories found */
  skills: string[]
  /** Prefixed agent files found */
  agents: string[]
  /** Prefixed command files found */
  commands: string[]
  /** Total count of prefixed items */
  totalFiles: number
}

/**
 * Scan a directory for files/dirs matching a prefix.
 * When prefix is empty, returns empty — we can't distinguish installed
 * files from user-created ones without a prefix.
 */
function scanDir(dir: string, prefix: string): string[] {
  if (!prefix || !existsSync(dir)) return []
  try {
    return readdirSync(dir).filter((f) => f.startsWith(`${prefix}-`))
  } catch {
    return []
  }
}

/**
 * Scan a .cursor/ directory for ecc-* prefixed content.
 */
export function scanDirectory(cursorDir: string, prefix: string): ScanResult {
  const ctx = createContext(cursorDir)

  const skills = scanDir(ctx.skillsDir, prefix)
  const agents = scanDir(ctx.agentsDir, prefix)
  const commands = scanDir(ctx.commandsDir, prefix)

  return {
    cursorDir,
    skills,
    agents,
    commands,
    totalFiles: skills.length + agents.length + commands.length,
  }
}

/**
 * Scan both user-level (~/.cursor/) and project-level (./.cursor/) directories.
 * Returns results for directories that contain ecc-* files.
 */
export function scanAll(prefix: string): ScanResult[] {
  const results: ScanResult[] = []

  // User-level
  const userDir = join(homedir(), '.cursor')
  if (existsSync(userDir)) {
    const result = scanDirectory(userDir, prefix)
    if (result.totalFiles > 0) results.push(result)
  }

  // Project-level (cwd)
  const projectDir = join(process.cwd(), '.cursor')
  if (existsSync(projectDir) && projectDir !== userDir) {
    const result = scanDirectory(projectDir, prefix)
    if (result.totalFiles > 0) results.push(result)
  }

  return results
}

/**
 * Format a scan result as a one-line summary.
 * e.g., "~/.cursor/ (12 skills, 3 agents, 2 commands)"
 */
export function formatScanResult(result: ScanResult): string {
  const parts: string[] = []
  if (result.skills.length > 0) parts.push(`${result.skills.length} skills`)
  if (result.agents.length > 0) parts.push(`${result.agents.length} agents`)
  if (result.commands.length > 0) parts.push(`${result.commands.length} commands`)
  return `${result.cursorDir} (${parts.join(', ')})`
}
