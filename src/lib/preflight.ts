import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Check that git is installed and accessible.
 * Returns the git version string, or throws with an install hint.
 */
export async function checkGit(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['--version'])
    return stdout.trim()
  } catch {
    throw new Error(
      'Git is required but not found in PATH.\n' + 'Install it from https://git-scm.com/downloads'
    )
  }
}

/**
 * Check that Node.js version is >= 20.
 * Returns true if OK, throws with a message if too old.
 */
export function checkNodeVersion(): boolean {
  const major = parseInt(process.version.slice(1), 10)
  if (major < 20) {
    throw new Error(
      `Node.js >= 20 is required (found ${process.version}).\nUpdate from https://nodejs.org/`
    )
  }
  return true
}

/**
 * Check if stdin is a TTY (interactive terminal).
 * Returns true if interactive, false if piped/redirected.
 */
export function isTTY(): boolean {
  return !!process.stdin.isTTY
}

/**
 * Run all pre-flight checks. Throws on first failure.
 */
export async function runPreflight(): Promise<void> {
  checkNodeVersion()
  await checkGit()
}
