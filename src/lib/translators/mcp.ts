import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpSelection } from '../../sync'
import { SRC_MCP, TOKEN_REQUIRED_MCP_SERVERS } from '../constants'
import type { TargetContext } from '../context'

// ── MCP config I/O ─────────────────────────────────────────────────────────────

interface ServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  description?: string
  [key: string]: unknown
}

interface McpConfig {
  mcpServers: Record<string, ServerConfig>
  [key: string]: unknown
}

/** Read and parse mcp.json. Returns empty config if missing or invalid. */
async function readMcpConfig(mcpFile: string): Promise<McpConfig> {
  if (!existsSync(mcpFile)) return { mcpServers: {} }
  try {
    const raw = await readFile(mcpFile, 'utf-8')
    const config = JSON.parse(raw)
    if (!config.mcpServers) config.mcpServers = {}
    return config as McpConfig
  } catch {
    return { mcpServers: {} }
  }
}

/** Write mcp.json with consistent formatting. */
async function writeMcpConfig(mcpFile: string, config: McpConfig): Promise<void> {
  await writeFile(mcpFile, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

// ── Auth detection ─────────────────────────────────────────────────────────────

function requiresAuth(serverConfig: ServerConfig): boolean {
  const json = JSON.stringify(serverConfig)

  const authPatterns = [
    /api[_-]?key/i,
    /token/i,
    /secret/i,
    /password/i,
    /auth/i,
    /bearer/i,
    /credentials/i,
    /\$\{[^}]*\}/,
    /process\.env\./,
    /YOUR_[A-Z_]+/,
    /\/path\/to\//,
  ]

  for (const pattern of authPatterns) {
    if (pattern.test(json)) return true
  }

  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    const envKeys = Object.keys(serverConfig.env)
    const authEnvPatterns = /key|token|secret|password|auth|api/i
    if (envKeys.some((k) => authEnvPatterns.test(k))) return true
  }

  return false
}

// ── Server discovery ───────────────────────────────────────────────────────────

export interface AvailableServer {
  name: string
  description: string
  config: ServerConfig
}

/**
 * Get all installable (token-free) MCP servers from the ECC repo.
 */
export async function getAvailableServers(repoDir: string): Promise<AvailableServer[]> {
  const srcFile = join(repoDir, SRC_MCP, 'mcp-servers.json')
  if (!existsSync(srcFile)) return []

  const srcRaw = await readFile(srcFile, 'utf-8')
  const srcConfig = JSON.parse(srcRaw)
  const srcServers: Record<string, ServerConfig> = srcConfig.mcpServers || {}

  const available: AvailableServer[] = []
  for (const [name, serverConfig] of Object.entries(srcServers)) {
    if (TOKEN_REQUIRED_MCP_SERVERS.has(name)) continue
    if (requiresAuth(serverConfig)) continue

    available.push({
      name,
      description: serverConfig.description || '',
      config: serverConfig,
    })
  }

  return available
}

/**
 * Read the set of MCP server names currently installed in the target mcp.json.
 * Synchronous for use in non-async contexts (scanner, picker).
 */
export function getInstalledServerNames(mcpFile: string): Set<string> {
  if (!existsSync(mcpFile)) return new Set()
  try {
    const raw = readFileSync(mcpFile, 'utf-8')
    const config = JSON.parse(raw)
    return new Set(Object.keys(config.mcpServers || {}))
  } catch {
    return new Set()
  }
}

// ── Install ────────────────────────────────────────────────────────────────────

function resolveSelectedServers(
  available: AvailableServer[],
  selection: McpSelection
): AvailableServer[] {
  if (selection === 'none') return []
  if (selection === 'all') return available
  const nameSet = new Set(selection)
  return available.filter((s) => nameSet.has(s.name))
}

export interface McpResult {
  added: number
  skipped: number
  updatedSelection: McpSelection
}

/**
 * Install selected MCP servers into the target mcp.json.
 * Selection must already be resolved (interactive picking done by UI layer).
 */
export async function translateMcp(
  repoDir: string,
  ctx: TargetContext,
  dryRun: boolean,
  selection: McpSelection
): Promise<McpResult> {
  const available = await getAvailableServers(repoDir)

  if (available.length === 0) {
    return { added: 0, skipped: 0, updatedSelection: selection }
  }

  if (selection === 'none') {
    return { added: 0, skipped: 0, updatedSelection: selection }
  }

  const toInstall = resolveSelectedServers(available, selection)
  const cursorMcp = await readMcpConfig(ctx.mcpFile)

  let added = 0
  let skipped = 0

  for (const server of toInstall) {
    if (cursorMcp.mcpServers[server.name]) {
      skipped++
      continue
    }

    const cleanConfig = { ...server.config }
    delete cleanConfig.description
    if (cleanConfig.command === 'npx') {
      cleanConfig.command = 'bunx'
    }

    if (!dryRun) {
      cursorMcp.mcpServers[server.name] = cleanConfig
    }
    added++
  }

  if (!dryRun && added > 0) {
    await writeMcpConfig(ctx.mcpFile, cursorMcp)
  }

  return { added, skipped, updatedSelection: selection }
}

// ── Clean ──────────────────────────────────────────────────────────────────────
