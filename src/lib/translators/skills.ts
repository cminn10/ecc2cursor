import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prefixName, SKIP_FILES, SRC_SKILLS } from '../constants'
import type { TargetContext } from '../context'
import { buildFrontmatter, parseFrontmatter, transformContent } from '../transform'

/**
 * Translate ECC skills → Cursor skills (mostly pass-through).
 * Returns list of relative file paths written.
 */
export async function translateSkills(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  dryRun: boolean
): Promise<string[]> {
  const srcDir = join(repoDir, SRC_SKILLS)
  const filesWritten: string[] = []

  let dirs: string[]
  try {
    dirs = await readdir(srcDir)
  } catch {
    return filesWritten
  }

  for (const dir of dirs) {
    if (SKIP_FILES.has(`${SRC_SKILLS}/${dir}`)) continue

    const skillSrcDir = join(srcDir, dir)
    const skillMdPath = join(skillSrcDir, 'SKILL.md')

    if (!existsSync(skillMdPath)) continue

    const skillName = prefixName(prefix, dir)
    const skillOutDir = join(ctx.skillsDir, skillName)

    const raw = await readFile(skillMdPath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(raw)

    const description = frontmatter.description || `Imported skill: ${dir}`
    const fm = buildFrontmatter({ name: skillName, description })
    const transformedBody = transformContent(body, prefix, `${SRC_SKILLS}/${dir}/SKILL.md`)
    const content = `${fm}\n\n${transformedBody.trimStart()}`

    const targetRel = `skills/${skillName}/SKILL.md`

    if (!dryRun) {
      await mkdir(skillOutDir, { recursive: true })
      await writeFile(join(skillOutDir, 'SKILL.md'), content, 'utf-8')
    }

    filesWritten.push(targetRel)

    // Copy sub-directories (rules/, etc.) with transforms
    const subEntries = await readdir(skillSrcDir)
    for (const sub of subEntries) {
      if (sub === 'SKILL.md') continue
      const subPath = join(skillSrcDir, sub)

      let subFiles: string[]
      try {
        subFiles = await readdir(subPath)
      } catch {
        continue
      }

      for (const sf of subFiles) {
        if (!sf.endsWith('.md')) continue
        const rawSub = await readFile(join(subPath, sf), 'utf-8')
        const transformedSub = transformContent(rawSub, prefix)

        const subTargetRel = `skills/${skillName}/${sub}/${sf}`

        if (!dryRun) {
          await mkdir(join(skillOutDir, sub), { recursive: true })
          await writeFile(join(skillOutDir, sub, sf), transformedSub, 'utf-8')
        }

        filesWritten.push(subTargetRel)
      }
    }
  }

  return filesWritten
}
