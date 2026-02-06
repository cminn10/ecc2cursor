import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // No DTS needed for a CLI tool
  dts: false,
  // Don't bundle node_modules — they'll be installed via npm
  skipNodeModulesBundle: true,
  // Inject version from package.json at build time
  define: {
    __VERSION__: JSON.stringify(version),
  },
})
