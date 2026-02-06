import { homedir } from 'node:os'

// ── Defaults ───────────────────────────────────────────────────────────────────

export const HOME = homedir()
export const DEFAULT_REPO = 'https://github.com/affaan-m/everything-claude-code.git'
export const DEFAULT_BRANCH = 'main'
export const DEFAULT_PREFIX = 'ecc'

// ── Prefix helper ──────────────────────────────────────────────────────────────

/**
 * Build a prefixed name. When prefix is empty, returns the bare name.
 *   prefixName("ecc", "typescript") → "ecc-typescript"
 *   prefixName("",    "typescript") → "typescript"
 */
export function prefixName(prefix: string, name: string): string {
  return prefix ? `${prefix}-${name}` : name
}

// ── Source directories inside the cloned repo ──────────────────────────────────

export const SRC_AGENTS = 'agents'
export const SRC_RULES = 'rules'
export const SRC_COMMANDS = 'commands'
export const SRC_SKILLS = 'skills'
export const SRC_CONTEXTS = 'contexts'
export const SRC_HOOKS = 'hooks'
export const SRC_MCP = 'mcp-configs'

// ── Languages ──────────────────────────────────────────────────────────────────

/** Well-known language → glob mappings (for skill descriptions). */
export const LANGUAGE_GLOBS: Record<string, string> = {
  typescript: '**/*.{ts,tsx,js,jsx}',
  javascript: '**/*.{js,jsx,mjs,cjs}',
  python: '**/*.py',
  golang: '**/*.go',
  go: '**/*.go',
  rust: '**/*.rs',
  java: '**/*.java',
  ruby: '**/*.rb',
  swift: '**/*.swift',
  kotlin: '**/*.kt',
  csharp: '**/*.cs',
  cpp: '**/*.{cpp,cc,cxx,h,hpp}',
}

// ── Files to skip entirely ─────────────────────────────────────────────────────

export const SKIP_FILES = new Set([
  // Claude Code plugin system specific
  'commands/setup-pm.md',
  'commands/checkpoint.md',
  'commands/verify.md',
  'commands/learn.md',
  'commands/skill-create.md',
  'commands/instinct-status.md',
  'commands/instinct-import.md',
  'commands/instinct-export.md',
  'commands/evolve.md',
  // Claude Code-only rules
  'rules/common/hooks.md',
  // Claude Code session-specific skills
  'skills/continuous-learning',
  'skills/continuous-learning-v2',
  'skills/strategic-compact',
  'skills/eval-harness',
  'skills/verification-loop',
  'skills/iterative-retrieval',
  // Name collision: rules translator already generates ecc-coding-standards
  'skills/coding-standards',
  // Claude Code plugin config skill
  'skills/configure-ecc',
])

// ── Markdown sections to strip from specific files ─────────────────────────────

export const STRIP_SECTIONS: Record<string, RegExp[]> = {
  'rules/common/performance.md': [
    /^## Model Selection Strategy[\s\S]*?(?=^## |\n$)/m,
    /^## Extended Thinking \+ Plan Mode[\s\S]*?(?=^## |\n$)/m,
  ],
  'rules/common/agents.md': [/^## Parallel Task Execution[\s\S]*?(?=^## |\n$)/m],
}

// ── Description overrides for skills/agents ────────────────────────────────────

export const AGENT_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'code-reviewer.md':
    'Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code, when asked to review changes, or before committing.',
  'planner.md':
    'Implementation planning for complex features and architectural changes. Use when starting new features, making significant changes, or when requirements need clarification before coding.',
  'tdd-guide.md':
    'Test-driven development guide. Use when implementing features, fixing bugs, or when the user wants to write tests first. Enforces RED-GREEN-REFACTOR with 80%+ coverage.',
  'architect.md':
    'System design and architectural decisions. Use for infrastructure choices, scalability planning, database schema design, or technology selection.',
  'security-reviewer.md':
    'Security vulnerability analysis. Use before commits, when handling auth/crypto/user-input code, or when the user asks for a security review.',
  'build-error-resolver.md':
    'Fix build and compilation errors. Use when builds fail, TypeScript/compiler errors occur, or dependency issues arise.',
  'e2e-runner.md':
    'End-to-end test generation with Playwright. Use when creating E2E tests, testing user flows, or verifying critical UI paths.',
  'refactor-cleaner.md':
    'Dead code removal and refactoring. Use when cleaning up unused code, simplifying complex modules, or reducing technical debt.',
  'doc-updater.md':
    'Documentation synchronization. Use when code changes require documentation updates, or when docs are stale or missing.',
  'go-reviewer.md':
    'Go code review specialist. Use when reviewing Go code for idioms, performance, and best practices.',
  'go-build-resolver.md':
    'Fix Go build errors. Use when Go builds fail, module issues occur, or compilation errors arise.',
}

export const SKILL_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'commands/plan.md':
    'Implementation planning for complex features and architectural changes. Use when starting new features, complex refactoring, or when requirements are unclear. Restates requirements, assesses risks, creates step-by-step plans, and waits for confirmation.',
  'commands/tdd.md':
    'Test-driven development workflow. Use when implementing features, fixing bugs, or when the user wants to write tests first. Enforces scaffold-interfaces, write-failing-tests, implement, refactor cycle.',
  'commands/code-review.md':
    'Code quality and security review. Use after writing or modifying code, when reviewing changes, or before committing. Checks security, performance, best practices.',
  'commands/e2e.md':
    'End-to-end test generation. Use when creating Playwright E2E tests for critical user flows and UI interactions.',
  'commands/build-fix.md':
    'Fix build and compilation errors. Use when builds fail or compiler errors occur.',
  'commands/refactor-clean.md':
    'Dead code removal and cleanup. Use when removing unused code or simplifying complex modules.',
  'commands/go-review.md':
    'Go code review. Use when reviewing Go code for idioms and best practices.',
  'commands/go-test.md':
    'Go TDD workflow. Use when writing Go tests or implementing Go features with TDD.',
  'commands/go-build.md': 'Fix Go build errors. Use when Go builds fail or module issues occur.',
}

// ── MCP servers that REQUIRE tokens/keys (denylist) ────────────────────────────

export const TOKEN_REQUIRED_MCP_SERVERS = new Set([
  'github',
  'gitlab',
  'bitbucket',
  'linear',
  'jira',
  'asana',
  'slack',
  'discord',
  'sentry',
  'datadog',
  'pagerduty',
  'stripe',
  'twilio',
  'sendgrid',
  'supabase',
  'firebase',
  'aws',
  'vercel',
  'netlify',
  'railway',
  'openai',
  'anthropic',
  'algolia',
  'elasticsearch',
  'redis',
  'mongodb',
  'postgres',
  'mysql',
])

// ── Content transforms (Claude Code → Cursor) ─────────────────────────────────

export interface ContentTransform {
  pattern: RegExp
  replace: string | ((match: string, ...groups: string[]) => string)
}

/**
 * Static content transforms that don't depend on the prefix.
 */
const STATIC_TRANSFORMS: ContentTransform[] = [
  // Generic path replacement (must come after prefix-specific ones)
  { pattern: /~\/\.claude\//g, replace: '~/.cursor/' },

  // Claude Code-specific terms
  { pattern: /CLAUDE\.md/g, replace: 'project configuration' },
  { pattern: /Claude Code CLI/g, replace: 'Cursor' },
  { pattern: /Claude Code/g, replace: 'Cursor' },

  // Tool name mapping
  { pattern: /\bBash tool\b/g, replace: 'Shell tool' },
  { pattern: /"Bash"/g, replace: '"Shell"' },
  { pattern: /"Edit"/g, replace: '"StrReplace"' },
]

/**
 * Build the full content transforms list, parameterized by prefix.
 * When prefix is empty, references use the original names without a dash.
 */
export function getContentTransforms(prefix: string): ContentTransform[] {
  const p = prefix ? `${prefix}-` : ''

  return [
    // Prefix-dependent path references (must come before generic ~/.claude/)
    {
      pattern: /~\/\.claude\/agents\/([\w-]+)\.md/g,
      replace: `~/.cursor/agents/${p}$1.md`,
    },
    {
      pattern: /~\/\.claude\/skills\/([\w-]+)\//g,
      replace: `~/.cursor/skills/${p}$1/`,
    },

    // Agent invocation references
    {
      pattern: /[Uu]se (?:the )?\*\*(\w[\w-]*)\*\* agent/g,
      replace: `Follow the **${p}$1** skill`,
    },
    {
      pattern: /invokes the `(\w[\w-]*)` agent/g,
      replace: `invokes the \`${p}$1\` skill`,
    },
    {
      pattern: /`(\w[\w-]*)` agent/g,
      replace: `\`${p}$1\` skill`,
    },

    // Known command references
    {
      pattern:
        /`\/(plan|tdd|code-review|build-fix|e2e|refactor-clean|learn|checkpoint|verify|go-review|go-test|go-build)`/g,
      replace: `\`/${p}$1\` command`,
    },
    {
      pattern:
        /\/(plan|tdd|code-review|build-and-fix|build-fix|e2e|refactor-clean|go-review|go-test|go-build)(?=[\s,.)])/g,
      replace: `/${p}$1`,
    },

    // Static transforms
    ...STATIC_TRANSFORMS,
  ]
}
