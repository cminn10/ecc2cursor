import { getContentTransforms, STRIP_SECTIONS } from './constants'

/**
 * Apply all content transforms to adapt Claude Code content for Cursor.
 * Prefix is used for agent/skill/command path references.
 */
export function transformContent(content: string, prefix: string, sourcePath?: string): string {
  let result = content

  // Strip sections specific to certain files
  if (sourcePath) {
    const strips = STRIP_SECTIONS[sourcePath]
    if (strips) {
      for (const pattern of strips) {
        result = result.replace(pattern, '')
      }
    }
  }

  // Apply all transforms (prefix-dependent + static)
  const transforms = getContentTransforms(prefix)
  for (const { pattern, replace } of transforms) {
    pattern.lastIndex = 0
    result = result.replace(pattern, replace as string)
  }

  // Clean up any double blank lines created by stripping
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

/**
 * Parse YAML-ish frontmatter from a markdown file.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const fmRaw = match[1]
  const body = match[2]
  const frontmatter: Record<string, string> = {}

  for (const line of fmRaw.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (kv) {
      const key = kv[1]
      let value = kv[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

/**
 * Build YAML frontmatter string from key-value pairs.
 * Note: Cursor's frontmatter parser does NOT support YAML block scalars
 * (e.g. `>` or `|`), so long values are kept on a single line.
 */
export function buildFrontmatter(fields: Record<string, string | boolean>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      // Collapse multi-line values into a single line
      const flat = value.replace(/\n+/g, ' ').trim()
      lines.push(`${key}: ${flat}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

/**
 * Extract the first markdown heading from content.
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

/**
 * Infer a description from content if none provided.
 */
export function inferDescription(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\s*\n?/, '')
  const match = body.match(/^#.*\n+([^#\n][^\n]+)/m)
  if (match) {
    let desc = match[1].trim()
    if (desc.length > 200) desc = `${desc.slice(0, 197)}...`
    return desc
  }
  return extractTitle(content) || 'Imported from Everything Claude Code'
}
