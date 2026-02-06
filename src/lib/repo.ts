import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// ── Temp directory tracking (for signal cleanup) ───────────────────────────────

const activeTmpDirs = new Set<string>()

function registerCleanupHandlers() {
  const cleanup = async () => {
    for (const dir of activeTmpDirs) {
      try {
        await rm(dir, { recursive: true, force: true })
      } catch {
        // Best-effort cleanup
      }
    }
    process.exit(130)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

// Register once at import time
registerCleanupHandlers()

// ── Clone ──────────────────────────────────────────────────────────────────────

export interface CloneResult {
  /** Absolute path to the cloned repo */
  repoDir: string
  /** HEAD commit SHA */
  sha: string
  /** Call to delete the temp directory */
  cleanup: () => Promise<void>
}

/**
 * Clone the ECC repo to a temporary directory.
 * Returns the repo path, HEAD SHA, and a cleanup function.
 *
 * The clone is always shallow (--depth 1) for speed.
 * Cleanup MUST be called (use try/finally) to remove the temp directory.
 *
 * Active temp directories are tracked so SIGINT/SIGTERM can clean them up
 * if the process is interrupted before cleanup() is called.
 */
export async function cloneRepo(repoUrl: string, branch: string): Promise<CloneResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'ecc2cursor-'))
  activeTmpDirs.add(tmpDir)

  const repoDir = join(tmpDir, 'repo')

  await execFileAsync('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, repoDir])

  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: repoDir,
  })

  const cleanup = async () => {
    activeTmpDirs.delete(tmpDir)
    await rm(tmpDir, { recursive: true, force: true })
  }

  return { repoDir, sha: stdout.trim(), cleanup }
}
