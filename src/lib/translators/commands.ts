import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prefixName, SKILL_DESCRIPTION_OVERRIDES, SKIP_FILES, SRC_COMMANDS } from '../constants'
import type { TargetContext } from '../context'
import {
  buildFrontmatter,
  extractTitle,
  inferDescription,
  parseFrontmatter,
  transformContent,
} from '../transform'

/**
 * Translate ECC commands → Cursor skills (full) + command wrappers (thin).
 * Returns list of relative file paths written.
 */
export async function translateCommands(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  dryRun: boolean
): Promise<string[]> {
  const srcDir = join(repoDir, SRC_COMMANDS)
  const filesWritten: string[] = []

  let files: string[]
  try {
    files = (await readdir(srcDir)).filter((f) => f.endsWith('.md'))
  } catch {
    return filesWritten
  }

  if (!dryRun) {
    await mkdir(ctx.commandsDir, { recursive: true })
  }

  for (const file of files) {
    const sourcePath = `${SRC_COMMANDS}/${file}`
    if (SKIP_FILES.has(sourcePath)) continue

    const raw = await readFile(join(srcDir, file), 'utf-8')
    const { frontmatter, body } = parseFrontmatter(raw)
    const baseName = file.replace(/\.md$/, '')
    const skillName = prefixName(prefix, baseName)

    // Build skill (full content)
    const description =
      SKILL_DESCRIPTION_OVERRIDES[sourcePath] || frontmatter.description || inferDescription(raw)

    const skillFm = buildFrontmatter({ name: skillName, description })
    const transformedBody = transformContent(body, prefix, sourcePath)
    const skillContent = `${skillFm}\n\n${transformedBody.trimStart()}`

    const skillTargetDir = join(ctx.skillsDir, skillName)
    const skillTargetRel = `skills/${skillName}/SKILL.md`

    if (!dryRun) {
      await mkdir(skillTargetDir, { recursive: true })
      await writeFile(join(skillTargetDir, 'SKILL.md'), skillContent, 'utf-8')
    }

    filesWritten.push(skillTargetRel)

    // Build command wrapper (thin)
    const title = extractTitle(body) || baseName.replace(/-/g, ' ')
    const shortDesc = frontmatter.description || `${description.split('.')[0]}.`

    const cmdContent = `# ${title}

${shortDesc}

For the full workflow, read and follow the skill at
~/.cursor/skills/${skillName}/SKILL.md
`

    const cmdFileName = `${prefixName(prefix, baseName)}.md`
    const cmdTargetRel = `commands/${cmdFileName}`

    if (!dryRun) {
      await writeFile(join(ctx.commandsDir, cmdFileName), cmdContent, 'utf-8')
    }

    filesWritten.push(cmdTargetRel)
  }

  return filesWritten
}
