import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prefixName, SRC_HOOKS } from '../constants'
import type { TargetContext } from '../context'

/**
 * Extract guideline intents from ECC hooks and write them as rule files
 * inside the coding-standards skill's rules/ directory.
 */

interface ExtractedRule {
  filename: string
  title: string
  content: string
}

const EXTRACTED_RULES: ExtractedRule[] = [
  {
    filename: 'no-console-log.md',
    title: 'No console.log in Production Code',
    content: `# No console.log in Production Code

Remove all \`console.log\` statements before committing.

## Why
- Clutters production output
- May leak sensitive data
- Indicates incomplete debugging

## Instead
- Use a proper logger (e.g., \`winston\`, \`pino\`) for server-side logging
- Use conditional debug logging: \`if (process.env.NODE_ENV === 'development')\`
- Remove debug logs entirely before committing

## Checklist
- [ ] No \`console.log\` in committed code
- [ ] Use structured logging for production
- [ ] Debug logging gated behind environment check
`,
  },
  {
    filename: 'review-before-push.md',
    title: 'Review Changes Before Pushing',
    content: `# Review Changes Before Pushing

Always review your changes before pushing to remote.

## Before \`git push\`
1. Run \`git diff\` to review unstaged changes
2. Run \`git diff --staged\` to review staged changes
3. Run \`git log --oneline -5\` to verify commit history
4. Ensure no secrets, debug code, or incomplete work is included

## Checklist
- [ ] All changes are intentional
- [ ] No hardcoded secrets or API keys
- [ ] No console.log or debug statements
- [ ] Commit messages follow conventional format
- [ ] Tests pass locally
`,
  },
  {
    filename: 'minimal-docs.md',
    title: 'Minimal Documentation Files',
    content: `# Minimal Documentation Files

Avoid creating unnecessary documentation files. Consolidate documentation in existing files.

## Guidelines
- Use the project's README.md for documentation
- Don't create random .md or .txt files for notes
- Keep documentation close to the code it describes
- Use code comments for implementation details
- Use JSDoc/docstrings for API documentation

## Acceptable documentation files
- README.md — project overview
- CONTRIBUTING.md — contribution guidelines
- CHANGELOG.md — version history
- API documentation generated from code
`,
  },
]

/**
 * Translate ECC hooks → coding standard rule files.
 * Returns list of relative file paths written.
 */
export async function translateHooks(
  repoDir: string,
  ctx: TargetContext,
  prefix: string,
  dryRun: boolean
): Promise<string[]> {
  const hooksFile = join(repoDir, SRC_HOOKS, 'hooks.json')
  const filesWritten: string[] = []

  if (!existsSync(hooksFile)) {
    return filesWritten
  }

  const codingStdSkillName = prefixName(prefix, 'coding-standards')
  const codingStdRulesDir = join(ctx.skillsDir, codingStdSkillName, 'rules')

  if (!dryRun) {
    await mkdir(codingStdRulesDir, { recursive: true })
  }

  for (const rule of EXTRACTED_RULES) {
    const targetRel = `skills/${codingStdSkillName}/rules/${rule.filename}`

    if (!dryRun) {
      await writeFile(join(codingStdRulesDir, rule.filename), rule.content, 'utf-8')
    }

    filesWritten.push(targetRel)
  }

  return filesWritten
}
