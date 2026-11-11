#!/usr/bin/env node
// Validate .github/release-notes/<tag>.md: it must exist and carry the four
// release headings in order. Usage: node scripts/check-release-notes.mjs v0.1.0
import { existsSync, readFileSync } from 'node:fs'

const tag = process.argv[2]
const file = `.github/release-notes/${tag}.md`
const HEADINGS = ['## Highlights', '## Breaking changes', '## Fixes', '## Compatibility']
if (!tag || !existsSync(file)) {
    console.error(`::error::missing release notes ${file}`)
    process.exit(1)
}
const lines = readFileSync(file, 'utf8').split('\n').map((line) => line.trim())
let at = -1
for (const heading of HEADINGS) {
    const next = lines.indexOf(heading, at + 1)
    if (next < 0) {
        console.error(`::error::${file} lacks "${heading}" (expected in this order: ${HEADINGS.join(', ')})`)
        process.exit(1)
    }
    at = next
}
console.log(file)
