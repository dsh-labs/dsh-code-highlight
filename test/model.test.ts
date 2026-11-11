import { describe, expect, it } from 'vitest'
import { buildRows, copyText, diffsFor, highlightRows, totals, type Highlighter } from '../src/client/model.ts'

/** Fake highlighter: one span per line, tagged with the side it was fed through. */
function tagging(tag: string, calls: string[] = []): Highlighter {
    return (code) => {
        calls.push(code)
        return code.split('\n').map((line) => [{ text: line, style: { color: tag } }])
    }
}

describe('buildRows', () => {
    it('flattens an edit into path, context, removed and added rows', () => {
        const rows = buildRows([{ path: 'a.ts', oldText: 'one\ntwo\nthree\n', newText: 'one\nTWO\nthree\n' }])
        expect(rows.map((row) => [row.kind, row.text])).toEqual([
            ['path', 'a.ts'],
            ['context', 'one'],
            ['del', 'two'],
            ['add', 'TWO'],
            ['context', 'three'],
        ])
        expect(copyText(rows)).toBe('a.ts\n  one\n- two\n+ TWO\n  three')
        expect(totals([{ path: 'a.ts', oldText: 'one\ntwo\nthree\n', newText: 'one\nTWO\nthree\n' }])).toEqual({ added: 1, removed: 1 })
    })

    it('treats a write as all-added lines', () => {
        const rows = buildRows([{ path: 'b.go', oldText: null, newText: 'package main\n\nfunc main() {}\n' }])
        expect(rows.slice(1).every((row) => row.kind === 'add')).toBe(true)
        expect(rows).toHaveLength(4)
    })
})

describe('highlightRows', () => {
    it('highlights old and new sides separately and maps tokens back', () => {
        const calls: string[] = []
        const rows = buildRows([{ path: 'a.ts', oldText: 'one\ntwo\nthree\n', newText: 'one\nTWO\nthree\n' }])
        let n = 0
        const highlighter: Highlighter = (code) => {
            n += 1
            return tagging(n === 1 ? 'old' : 'new', calls)(code)
        }
        const tokens = highlightRows(rows, () => highlighter)
        // old side = context + removed; new side = context + added
        expect(calls).toEqual(['one\ntwo\nthree', 'one\nTWO\nthree'])
        expect(tokens[0]).toBeUndefined() // path row
        expect(tokens.map((spans) => spans?.[0]?.style.color)).toEqual([undefined, 'new', 'old', 'new', 'new'])
        expect(tokens[2]?.[0]?.text).toBe('two')
        expect(tokens[3]?.[0]?.text).toBe('TWO')
    })

    it('tokenizes each hunk independently', () => {
        const oldText = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n'
        const newText = oldText.replace('line 2\n', 'line two\n').replace('line 25\n', 'line twenty-five\n')
        const rows = buildRows([{ path: 'x.rs', oldText, newText }])
        expect(rows.filter((row) => row.kind === 'gap')).toHaveLength(1)
        const calls: string[] = []
        const tokens = highlightRows(rows, () => tagging('t', calls))
        expect(calls).toHaveLength(4) // 2 hunks x 2 sides
        rows.forEach((row, i) => {
            if (row.hunk >= 0) expect(tokens[i]?.[0]?.text).toBe(row.text)
        })
    })

    it('leaves rows plain when the language is unknown or the grammar is not ready', () => {
        const rows = buildRows([{ path: 'a.ts', oldText: 'a\n', newText: 'b\n' }])
        expect(highlightRows(rows, () => undefined).every((spans) => spans === undefined)).toBe(true)
        expect(highlightRows(rows, () => () => undefined).every((spans) => spans === undefined)).toBe(true)
    })

    it('uses each file its own highlighter in a multi-file patch', () => {
        const rows = buildRows([
            { path: 'a.go', oldText: 'x\n', newText: 'y\n' },
            { path: 'notes.unknownext', oldText: 'p\n', newText: 'q\n' },
        ])
        const tokens = highlightRows(rows, (file) => (file === 0 ? tagging('go') : undefined))
        rows.forEach((row, i) => {
            if (row.hunk < 0) return
            expect(tokens[i] === undefined).toBe(row.file === 1)
        })
    })
})

describe('diffsFor', () => {
    const settled = (name: string, args: unknown, meta: unknown = {}) => ({
        callId: 'c',
        kind: 'tool-result' as const,
        call: { name, argsRaw: JSON.stringify(args) },
        isError: false,
        meta,
    })

    it('shows the intended diff while running', () => {
        const block = { callId: 'c', phase: 'start' as const, argsRaw: JSON.stringify({ file_path: 'a.ts', old_string: 'a', new_string: 'b' }) }
        expect(diffsFor('edit', block)).toEqual([{ path: 'a.ts', oldText: 'a', newText: 'b' }])
    })

    it('uses applied meta.diffs once settled and keeps the authored path', () => {
        const block = settled('edit', { file_path: 'a.ts', old_string: 'a', new_string: 'b' }, { path: '/w/a.ts', diffs: [{ path: '/w/a.ts', oldText: 'x\na\n', newText: 'x\nb\n' }] })
        expect(diffsFor('edit', block)).toEqual([{ path: 'a.ts', oldText: 'x\na\n', newText: 'x\nb\n' }])
    })

    it('keeps a write whole-file diff with empty metadata, drops an edit without it', () => {
        expect(diffsFor('write', settled('write', { file_path: 'a.go', content: 'package a\n' }))).toEqual([{ path: 'a.go', oldText: null, newText: 'package a\n' }])
        expect(diffsFor('edit', settled('edit', { file_path: 'a.go', old_string: 'a', new_string: 'b' }))).toBeNull()
    })

    it('reads apply_patch diffs only from settled metadata', () => {
        const meta = { diffs: [{ path: 'a.rs', oldText: 'a\n', newText: 'b\n' }] }
        expect(diffsFor('apply_patch', settled('apply_patch', { patch: '...' }, meta))).toEqual(meta.diffs)
        expect(diffsFor('apply_patch', { callId: 'c', phase: 'start', argsRaw: '{"patch":"..."}' })).toBeNull()
    })

    it('leaves nested (PTC) and failed calls to the stock card', () => {
        expect(diffsFor('write', { ...settled('write', { file_path: 'a.go', content: 'x' }), parentCallId: 'p' })).toBeNull()
        expect(diffsFor('write', { ...settled('write', { file_path: 'a.go', content: 'x' }), isError: true })).toBeNull()
    })
})
