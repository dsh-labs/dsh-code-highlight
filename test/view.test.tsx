import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, useState, type ReactNode } from 'react'

const highlighterCalls: (string | undefined)[] = []

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
    const { languageForPath } = await import('@deepseek-ai/dsh-util-code-language')
    const span = (props: { children?: ReactNode; className?: string }) => createElement('span', { className: props.className }, props.children)
    const icon = () => createElement('svg')
    return {
        languageForPath,
        useCodeHighlighter: (language: string | undefined) => {
            highlighterCalls.push(language)
            return (code: string) => (language === undefined ? undefined : code.split('\n').map((line) => [{ text: line, style: { color: `var(--shiki-token-${language})` } }]))
        },
        TextShimmer: span,
        Tooltip: (props: { children: ReactNode }) => props.children,
        writeClipboard: async () => true,
        IconCheckOutlineRegular: icon,
        IconCopyOutlineRegular: icon,
        IconEditOutlineRegular: icon,
        IconInspectOutlineRegular: icon,
        IconNowrapFillRegular: icon,
        IconWrapFillRegular: icon,
        DisclosureRow: (props: { title: string; open: boolean; onToggle: () => void; collapsedContent?: ReactNode; children?: ReactNode }) =>
            createElement('div', { 'data-testid': 'row' }, createElement('button', { 'aria-expanded': props.open, className: 'dch-row', onClick: props.onToggle }, props.title), props.collapsedContent, props.open ? props.children : null),
    }
})

const { MutationView } = await import('../src/client/MutationView.tsx')
const { apply, nextEntry, PRIORITY } = await import('../src/client/index.ts')

afterEach(() => {
    cleanup()
    highlighterCalls.length = 0
})

function useDisclosureFactory() {
    return () => {
        const [expanded, setExpanded] = useState(false)
        return { expanded, toggle: () => setExpanded((v) => !v) }
    }
}

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

function props(toolName: string, block: unknown, stock = vi.fn(() => createElement('div', { 'data-testid': 'stock' }, 'STOCK'))) {
    return {
        toolName,
        phase: 'result' as const,
        block: block as never,
        cwd: '/w',
        home: '/Users/me',
        sessionId: 's1',
        openFile: vi.fn(),
        useDisclosure: useDisclosureFactory(),
        t,
        stockView: () => ({ Component: stock as never, injected: { resolveFilePath: (p: string) => p } }),
    }
}

const settledWrite = (path: string, content: string) => ({
    callId: 'c',
    kind: 'tool-result',
    call: { name: 'write', argsRaw: JSON.stringify({ file_path: path, content }) },
    isError: false,
    meta: { path: `/w/${path}`, diffs: [] },
})

describe('MutationView', () => {
    it('renders a highlighted diff once expanded, with the stock chrome', () => {
        render(createElement(MutationView, props('write', settledWrite('main.go', 'package main\n\nfunc main() {}\n'))))
        expect(screen.getByText('tool.title.write')).toBeTruthy()
        expect(screen.getByText('main.go')).toBeTruthy()
        expect(screen.getByText('+3')).toBeTruthy()
        expect(highlighterCalls).toEqual([]) // nothing highlighted while collapsed
        fireEvent.click(screen.getByText('tool.title.write'))
        const lines = document.querySelectorAll('.dch-line.dch-add[data-highlighted]')
        expect(lines).toHaveLength(3)
        expect((lines[0]!.firstChild as HTMLElement).style.color).toBe('var(--shiki-token-go)')
        expect(document.querySelector('.dch-language')!.textContent).toBe('go')
        expect(highlighterCalls).toContain('go')
    })

    it('hands unknown languages to the stock view untouched', () => {
        const stock = vi.fn(() => createElement('div', { 'data-testid': 'stock' }, 'STOCK'))
        const p = props('write', settledWrite('notes.unknownext', 'x\n'), stock)
        render(createElement(MutationView, p))
        expect(screen.getByTestId('stock')).toBeTruthy()
        const received = (stock.mock.calls[0] as unknown[])[0] as Record<string, unknown>
        expect(received.block).toBe(p.block)
        expect(received.resolveFilePath).toBeTypeOf('function')
        expect('stockView' in received).toBe(false)
    })

    it('folds long diffs like the stock card (9 rows)', () => {
        const content = Array.from({ length: 30 }, (_, i) => `echo ${i}`).join('\n') + '\n'
        render(createElement(MutationView, props('write', settledWrite('run.sh', content))))
        fireEvent.click(screen.getByText('tool.title.write'))
        expect(document.querySelectorAll('.dch-line')).toHaveLength(9)
        fireEvent.click(screen.getByText('diff.expandRest:{"count":22}'))
        expect(document.querySelectorAll('.dch-line')).toHaveLength(31)
    })
})

describe('registration', () => {
    it('registers only edit, write and apply_patch, ahead of the stock view', () => {
        const registered: Record<string, unknown>[] = []
        const ctx = {
            effect: () => {},
            slots: {
                inject: (key: string, callback: () => Iterable<() => void>) => {
                    expect(key).toBe('tool.call.toolview')
                    for (const _ of callback()) void _
                    return () => {}
                },
                register: (options: Record<string, unknown>) => {
                    registered.push(options)
                    return () => {}
                },
                entries: () => [],
            },
        }
        apply(ctx as never)
        expect(registered.map((o) => o.key)).toEqual(['edit', 'write', 'apply_patch'])
        expect(registered.every((o) => o.name === 'tool.call.toolview' && o.priority === PRIORITY && o.locale === 'conversation')).toBe(true)
        expect(PRIORITY).toBeLessThan(0)
    })

    it('finds the view DSH would render without this plugin', () => {
        const own = () => null
        const stock = () => null
        const other = () => null
        const entries = [
            { component: stock, options: { key: 'edit' } },
            { component: own, options: { key: 'edit', priority: -10 } },
            { component: other, options: { key: 'read' } },
        ]
        expect(nextEntry(entries as never, 'edit', own)?.component).toBe(stock)
        expect(nextEntry(entries as never, 'apply_patch', own)).toBeUndefined()
    })
})
