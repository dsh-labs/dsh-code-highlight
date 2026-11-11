import { describe, expect, it } from 'vitest'
import { languageForPath } from '@deepseek-ai/dsh-util-code-language'
import { planFor } from '../src/client/plan.ts'

const write = (path: string, content: string, extra: Record<string, unknown> = {}) => ({
    callId: 'c',
    kind: 'tool-result' as const,
    call: { name: 'write', argsRaw: JSON.stringify({ file_path: path, content }) },
    isError: false,
    meta: {},
    ...extra,
})

describe('planFor', () => {
    it('takes over a highlighted language', () => {
        const plan = planFor('write', write('main.go', 'package main\n'), languageForPath)
        expect(plan.kind).toBe('own')
        if (plan.kind === 'own') expect(plan.languages).toEqual(['go'])
    })

    it('leaves an unknown language exactly to the stock card', () => {
        expect(planFor('write', write('notes.unknownext', 'x\n'), languageForPath)).toEqual({ kind: 'stock', reason: 'unknown-language' })
    })

    it('falls back to the stock (plain) card past the row cap', () => {
        const big = Array.from({ length: 50 }, (_, i) => `const v${i} = ${i}`).join('\n')
        expect(planFor('write', write('big.ts', big), languageForPath, 40)).toEqual({ kind: 'stock', reason: 'over-cap' })
        expect(planFor('write', write('big.ts', big), languageForPath, 60).kind).toBe('own')
    })

    it('leaves preparing, failed and stopped calls to the stock card', () => {
        expect(planFor('write', { callId: 'c', phase: 'preparing' }, languageForPath)).toEqual({ kind: 'stock', reason: 'phase' })
        expect(planFor('write', write('a.ts', 'x', { isError: true }), languageForPath)).toEqual({ kind: 'stock', reason: 'state' })
        expect(planFor('write', write('a.ts', 'x', { error: { name: 'E', code: 'interrupted' } }), languageForPath)).toEqual({ kind: 'stock', reason: 'state' })
        expect(planFor('write', write('a.ts', 'x', { meta: { stopped: true } }), languageForPath)).toEqual({ kind: 'stock', reason: 'state' })
    })
})
