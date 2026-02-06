import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AGENT_DESCRIPTION_OVERRIDES, prefixName, SKIP_FILES, SRC_AGENTS } from '../constants'
import type { TargetContext } from '../context'
import { buildFrontmatter, parseFrontmatter, transformContent } from '../transform'

/**
 * Translate ECC agents → Cursor subagents.
 * Returns list of relative file paths written.
 */
export async function translateAgents(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  dryRun: boolean
): Promise<string[]> {
  const srcDir = join(repoDir, SRC_AGENTS)
  const filesWritten: string[] = []

  let files: string[]
  try {
    files = (await readdir(srcDir)).filter((f) => f.endsWith('.md'))
  } catch {
    return filesWritten
  }

  await mkdir(ctx.agentsDir, { recursive: true })

  for (const file of files) {
    const sourcePath = `${SRC_AGENTS}/${file}`
    if (SKIP_FILES.has(sourcePath)) continue

    const raw = await readFile(join(srcDir, file), 'utf-8')
    const { frontmatter, body } = parseFrontmatter(raw)

    const name = prefixName(prefix, frontmatter.name || file.replace(/\.md$/, ''))
    const description = AGENT_DESCRIPTION_OVERRIDES[file] || frontmatter.description || ''

    const newFm = buildFrontmatter({ name, description })
    const transformedBody = transformContent(body, prefix, sourcePath)
    const content = `${newFm}\n\n${transformedBody.trimStart()}`

    const targetRel = `agents/${name}.md`
    const targetFull = join(ctx.agentsDir, `${name}.md`)

    if (!dryRun) {
      await writeFile(targetFull, content, 'utf-8')
    }

    filesWritten.push(targetRel)
  }

  return filesWritten
}
