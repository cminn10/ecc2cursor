import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prefixName, SRC_CONTEXTS } from '../constants'
import type { TargetContext } from '../context'
import { buildFrontmatter, extractTitle, inferDescription, transformContent } from '../transform'

/**
 * Translate ECC contexts → Cursor skills.
 * Returns list of relative file paths written.
 */
export async function translateContexts(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  dryRun: boolean
): Promise<string[]> {
  const srcDir = join(repoDir, SRC_CONTEXTS)
  const filesWritten: string[] = []

  let files: string[]
  try {
    files = (await readdir(srcDir)).filter((f) => f.endsWith('.md'))
  } catch {
    return filesWritten
  }

  for (const file of files) {
    const sourcePath = `${SRC_CONTEXTS}/${file}`
    const raw = await readFile(join(srcDir, file), 'utf-8')
    const baseName = file.replace(/\.md$/, '')
    const skillName = prefixName(prefix, `ctx-${baseName}`)

    const _title = extractTitle(raw) || baseName
    const description = inferDescription(raw)

    const fm = buildFrontmatter({ name: skillName, description })
    const transformedBody = transformContent(raw, prefix, sourcePath)
    const content = `${fm}\n\n${transformedBody.trimStart()}`

    const skillDir = join(ctx.skillsDir, skillName)
    const targetRel = `skills/${skillName}/SKILL.md`

    if (!dryRun) {
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8')
    }

    filesWritten.push(targetRel)
  }

  return filesWritten
}
