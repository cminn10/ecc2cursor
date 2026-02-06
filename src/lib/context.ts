import { join } from 'node:path'

/**
 * TargetContext describes where Cursor config files live.
 * All translators receive this instead of importing global path constants.
 */
export interface TargetContext {
  /** Root .cursor dir (e.g., ~/.cursor or ./project/.cursor) */
  cursorDir: string
  skillsDir: string
  agentsDir: string
  commandsDir: string
  mcpFile: string
}

/**
 * Build a TargetContext from a .cursor/ directory path.
 */
export function createContext(cursorDir: string): TargetContext {
  return {
    cursorDir,
    skillsDir: join(cursorDir, 'skills'),
    agentsDir: join(cursorDir, 'agents'),
    commandsDir: join(cursorDir, 'commands'),
    mcpFile: join(cursorDir, 'mcp.json'),
  }
}
