import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { LANGUAGE_GLOBS, prefixName, SKIP_FILES, SRC_RULES } from '../constants'
import type { TargetContext } from '../context'
import { buildFrontmatter, extractTitle, transformContent } from '../transform'

/**
 * Discover language subdirectories under rules/.
 */
export async function discoverLanguages(rulesDir: string): Promise<string[]> {
  if (!existsSync(rulesDir)) return []
  const entries = await readdir(rulesDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith('.') && name !== 'README.md')
}

/**
 * Translate ECC rules → Cursor skills (bundled per language group).
 * Returns list of relative file paths written.
 */
export async function translateRules(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  languages: 'auto' | string[],
  dryRun: boolean
): Promise<string[]> {
  const srcDir = join(repoDir, SRC_RULES)
  const filesWritten: string[] = []

  let langList: string[]
  if (languages === 'auto') {
    langList = await discoverLanguages(srcDir)
  } else {
    langList = languages
  }

  for (const lang of langList) {
    const langDir = join(srcDir, lang)
    if (!existsSync(langDir)) continue

    let files: string[]
    try {
      files = (await readdir(langDir)).filter((f) => f.endsWith('.md') && f !== 'README.md')
    } catch {
      continue
    }

    if (files.length === 0) continue

    const skillName =
      lang === 'common' ? prefixName(prefix, 'coding-standards') : prefixName(prefix, lang)
    const skillDir = join(ctx.skillsDir, skillName)
    const rulesDir = join(skillDir, 'rules')

    if (!dryRun) {
      await mkdir(rulesDir, { recursive: true })
    }

    const ruleEntries: {
      filename: string
      title: string
      description: string
    }[] = []

    for (const file of files) {
      const sourcePath = `${SRC_RULES}/${lang}/${file}`
      if (SKIP_FILES.has(sourcePath)) continue

      const raw = await readFile(join(langDir, file), 'utf-8')
      const transformed = transformContent(raw, prefix, sourcePath)
      const title = extractTitle(transformed) || file.replace(/\.md$/, '')

      const firstPara = transformed
        .replace(/^#.*\n+/, '')
        .split('\n\n')[0]
        ?.trim()
        .slice(0, 120)

      ruleEntries.push({
        filename: file,
        title,
        description: firstPara || title,
      })

      const targetRel = `skills/${skillName}/rules/${file}`

      if (!dryRun) {
        await writeFile(join(rulesDir, file), transformed, 'utf-8')
      }

      filesWritten.push(targetRel)
    }

    // Generate SKILL.md index
    const skillMd = generateRulesSkillMd(skillName, lang, ruleEntries)
    const skillMdTarget = `skills/${skillName}/SKILL.md`

    if (!dryRun) {
      await writeFile(join(skillDir, 'SKILL.md'), skillMd, 'utf-8')
    }

    filesWritten.push(skillMdTarget)
  }

  return filesWritten
}

function generateRulesSkillMd(
  skillName: string,
  lang: string,
  rules: { filename: string; title: string; description: string }[]
): string {
  const langLabel = lang === 'common' ? 'General' : lang.charAt(0).toUpperCase() + lang.slice(1)
  const globs = LANGUAGE_GLOBS[lang]

  let description: string
  if (lang === 'common') {
    description =
      'Coding standards, quality practices, security guidelines, testing requirements, ' +
      'git workflow, and development patterns. Use when writing, reviewing, modifying, ' +
      'planning, or committing any code.'
  } else {
    description =
      `${langLabel} coding standards and best practices. Use when working with ` +
      `${langLabel} files${globs ? ` (${globs})` : ''}.`
  }

  const fm = buildFrontmatter({ name: skillName, description })

  const rulesTable = rules
    .map((r) => `| ${r.title} | [${r.filename}](rules/${r.filename}) |`)
    .join('\n')

  return `${fm}

# ${langLabel} Coding Standards

Guidelines imported from [Everything Claude Code](https://github.com/affaan-m/everything-claude-code).

## Rules

| Topic | Details |
|-------|---------|
${rulesTable}

Read individual rule files for detailed guidelines and examples.
`
}
