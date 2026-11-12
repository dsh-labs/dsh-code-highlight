#!/usr/bin/env node
/**
 * Contract check against the PUBLIC npm packages of each supported DSH
 * release: the `tool.call.toolview` slot declaration and owner props, the
 * primitives exports this plugin uses (`useCodeHighlighter`,
 * `languageForPath`, …), the slot registry surface, and `languageForPath`'s
 * behaviour for the five target languages. Fails (exit 1) on any drift.
 *
 * Usage: node scripts/contract.mjs [version ...]   (default: 0.2.2-rc.2 0.2.2-rc.1 0.2.1-rc.5)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const versions = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['0.2.2-rc.2', '0.2.2-rc.1', '0.2.1-rc.5']
const cache = join(tmpdir(), 'dsh-code-highlight-contract')
const PACKAGES = ['dsh-client-ui-tool', 'dsh-client-ui-primitives', 'dsh-client-ui-slots', 'dsh-client-ui-conversation', 'dsh-util-code-language']

function fetch(pkg, version) {
    const dir = join(cache, `${pkg}@${version}`)
    if (!existsSync(join(dir, 'package', 'package.json'))) {
        mkdirSync(dir, { recursive: true })
        const file = execFileSync('npm', ['pack', `@deepseek-ai/${pkg}@${version}`, '--silent', '--pack-destination', dir], { encoding: 'utf8' }).trim().split('\n').pop()
        execFileSync('tar', ['xzf', join(dir, file), '-C', dir])
    }
    return join(dir, 'package')
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
let failures = 0
function check(version, label, ok) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${version}] ${label}`)
    if (!ok) failures += 1
}

for (const version of versions) {
    const root = Object.fromEntries(PACKAGES.map((pkg) => [pkg, fetch(pkg, version)]))

    // tool.call.toolview: keyed, session-scoped, ToolCallOwnerProps owner.
    const toolSlots = read(root['dsh-client-ui-tool'], 'lib/types/client/contract/slots.d.ts')
    check(version, "tool.call.toolview is keyed/session with owner ToolCallOwnerProps", /'tool\.call\.toolview':\s*\{\s*kind:\s*'keyed';\s*scope:\s*'session';\s*owner:\s*ToolCallOwnerProps;/.test(toolSlots))
    for (const field of ['useDisclosure: UseDisclosure;', 'callId: string;', 'toolName: string;', 'cwd?: string | undefined;', 'home?: string | undefined;', 'openFile: (path: string, options?: OpenFileOptions) => void;', 'inspect?: (() => void) | undefined;']) {
        check(version, `ToolCallCommonProps has ${field}`, toolSlots.includes(field))
    }
    check(version, 'phase union preparing/start/result', ["readonly phase: 'preparing';", "readonly phase: 'start';", "readonly phase: 'result';"].every((s) => toolSlots.includes(s)))

    // Tool blocks: the fields this plugin reads.
    const records = read(root['dsh-client-ui-conversation'], 'lib/types/client/contract/records.d.ts')
    const result = records.slice(records.indexOf('export interface ToolResultNode'), records.indexOf('}', records.indexOf('subCalls', records.indexOf('export interface ToolResultNode'))))
    for (const field of ["kind: 'tool-result';", 'parentCallId?: string;', 'argsRaw: string;', 'isError: boolean;', 'code: string;', 'meta?: unknown;']) {
        check(version, `ToolResultNode has ${field}`, result.includes(field))
    }
    check(version, 'StartedToolCall has phase start + argsRaw', /interface StartedToolCall[^}]*readonly phase: 'start';[^}]*readonly argsRaw: string;/s.test(records))

    // Primitives: highlighter and the chrome this card reuses.
    const prim = root['dsh-client-ui-primitives']
    const hl = read(prim, 'lib/types/code-highlighting.d.ts')
    check(version, 'useCodeHighlighter(language: string | undefined): CodeHighlighter', hl.includes('export declare function useCodeHighlighter(language: string | undefined): CodeHighlighter;'))
    check(version, 'CodeHighlighter = (code: string) => HighlightSpan[][] | undefined', hl.includes('export type CodeHighlighter = (code: string) => HighlightSpan[][] | undefined;'))
    check(version, 'languageForPath re-exported from dsh-util-code-language', /export \{[^}]*languageForPath[^}]*\} from '@deepseek-ai\/dsh-util-code-language'/.test(hl))
    const span = read(prim, 'lib/types/markdown/highlight.d.ts')
    check(version, 'HighlightSpan { text: string; style: CSSProperties }', /interface HighlightSpan \{\s*text: string;\s*style: CSSProperties;\s*\}/.test(span))
    const primIndex = read(prim, 'lib/types/index.d.ts')
    const icons = read(prim, 'lib/types/icons/index.d.ts')
    for (const name of ['useCodeHighlighter', 'languageForPath', 'DisclosureRow', 'TextShimmer', 'Tooltip', 'writeClipboard']) {
        check(version, `primitives types export ${name}`, new RegExp(`export \\{[^}]*\\b${name}\\b[^}]*\\}`).test(primIndex))
    }
    for (const name of ['IconCheckOutlineRegular', 'IconCopyOutlineRegular', 'IconEditOutlineRegular', 'IconInspectOutlineRegular', 'IconNowrapFillRegular', 'IconWrapFillRegular']) {
        check(version, `primitives exports ${name}`, icons.includes(`export declare const ${name}:`))
    }
    const runtimeExports = read(prim, 'lib/index.js').slice(read(prim, 'lib/index.js').lastIndexOf('export {'))
    for (const name of ['useCodeHighlighter', 'languageForPath', 'DisclosureRow', 'TextShimmer', 'Tooltip', 'writeClipboard', 'IconEditOutlineRegular']) {
        check(version, `primitives runtime exports ${name}`, new RegExp(`\\b${name}\\b`).test(runtimeExports))
    }
    const disclosure = read(prim, 'lib/types/DisclosureRow.d.ts')
    for (const prop of ['icon: ReactNode;', 'title: string;', 'open: boolean;', 'expandable: boolean;', 'onToggle: () => void;', 'collapsedContent?: ReactNode;', 'rowClassName?: string | undefined;']) {
        check(version, `DisclosureRowProps has ${prop}`, disclosure.includes(prop))
    }

    // Slot registry: keyed shadowing by priority, entries() and StoredEntry.
    const slots = read(root['dsh-client-ui-slots'], 'lib/types/index.d.ts')
    check(version, 'SlotCore.entries(key) exists', slots.includes('entries(key: string): readonly StoredEntry[];'))
    check(version, 'StoredEntry has component/options.key/options.priority/inject', /interface StoredEntry \{\s*component: unknown;\s*options: \{\s*key\?: string;[\s\S]*?priority\?: number;[\s\S]*?inject\?:/.test(slots))
    check(version, 'keyed cells shadow by ascending priority', slots.includes('sorted ascending with ties keeping registration order'))

    // languageForPath behaviour for the five languages (public, pure ESM).
    const lang = await import(pathToFileURL(join(root['dsh-util-code-language'], 'lib/index.js')).href)
    const expected = { 'a.go': 'go', 'a.md': 'markdown', 'a.markdown': 'markdown', 'a.rs': 'rust', 'a.sh': 'shellscript', 'a.bash': 'shellscript', 'a.zsh': 'shellscript', 'a.ts': 'typescript', 'a.tsx': 'typescript', 'a.mts': 'typescript', 'a.cts': 'typescript' }
    for (const [path, language] of Object.entries(expected)) check(version, `languageForPath(${path}) = ${language}`, lang.languageForPath(path) === language)
}

if (failures > 0) {
    console.error(`\n${failures} contract check(s) failed`)
    process.exit(1)
}
console.log('\nall contract checks passed')
