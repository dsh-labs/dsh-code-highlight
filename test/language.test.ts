import { describe, expect, it } from 'vitest'
// DSH's own table, the same function the primitives package re-exports.
import { languageForPath } from '@deepseek-ai/dsh-util-code-language'
import { planFor } from '../src/client/plan.ts'

const CASES: [string, string][] = [
    ['main.go', 'go'],
    ['README.md', 'markdown'],
    ['docs/guide.markdown', 'markdown'],
    ['src/lib.rs', 'rust'],
    ['run.sh', 'shellscript'],
    ['setup.bash', 'shellscript'],
    ['rc.zsh', 'shellscript'],
    ['index.ts', 'typescript'],
    ['App.tsx', 'typescript'],
    ['mod.mts', 'typescript'],
    ['mod.cts', 'typescript'],
    ['/abs/path/MAIN.GO', 'go'],
]

describe('language mapping (DSH languageForPath)', () => {
    it.each(CASES)('%s -> %s', (path, language) => {
        expect(languageForPath(path)).toBe(language)
    })

    it('leaves unknown and extension-less files unmapped', () => {
        expect(languageForPath('notes.unknownext')).toBeUndefined()
        expect(languageForPath('Dockerfile')).toBeUndefined()
        expect(languageForPath('scripts/deploy')).toBeUndefined()
    })

    it('a write of an extension-less shell script stays stock (no shebang detection, by design)', () => {
        const block = {
            callId: 'c1',
            kind: 'tool-result' as const,
            call: { name: 'write', argsRaw: JSON.stringify({ file_path: 'deploy', content: '#!/usr/bin/env bash\necho hi\n' }) },
            isError: false,
            meta: {},
        }
        expect(planFor('write', block, languageForPath)).toEqual({ kind: 'stock', reason: 'unknown-language' })
    })
})
