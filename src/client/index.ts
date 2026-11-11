/**
 * Client half: registers the highlighted view for edit / write / apply_patch
 * in the public keyed `tool.call.toolview` slot, ahead of the stock view.
 */
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { Context } from '@deepseek-ai/cordis'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import { MUTATION_TOOLS } from './model.ts'
import { MutationView, type StockView } from './MutationView.tsx'
import { installStyles } from './styles.ts'

export const name = 'dsh-code-highlight'
export const inject = ['slots']

/** Below the stock entry (0) and below other common overrides (-1), so this view wins its cells. */
export const PRIORITY = -10

/** Slot name, kept as a constant so the contract test can pin it. */
export const TOOLVIEW_SLOT = 'tool.call.toolview'

/**
 * The entry that would render a cell without this plugin: the lowest-priority
 * live entry for `key` other than ours.
 */
export function nextEntry(entries: readonly StoredEntry[], key: string, own: unknown): StoredEntry | undefined {
    return entries
        .filter((entry) => entry.options.key === key && entry.component !== own)
        .sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))[0]
}

interface SlotsFace {
    inject: (key: string, callback: () => Iterable<() => void> | (() => void)) => () => void
    register: (options: Record<string, unknown>, component: unknown) => () => void
    entries: (key: string) => readonly StoredEntry[]
    isLive?: (entry: StoredEntry) => boolean
}

const injectedCache = new WeakMap<StoredEntry, Map<string, Record<string, unknown>>>()

/** The stock entry's own inject result, computed once per entry and Session like the renderer does. */
function stockInjected(entry: StoredEntry, sessionId: string): Record<string, unknown> {
    let bySession = injectedCache.get(entry)
    if (bySession === undefined) {
        bySession = new Map()
        injectedCache.set(entry, bySession)
    }
    let injected = bySession.get(sessionId)
    if (injected === undefined) {
        injected = (entry.inject as ((id: string) => Record<string, unknown>) | undefined)?.(sessionId) ?? {}
        bySession.set(sessionId, injected)
    }
    return injected
}

export function apply(ctx: Context): void {
    const slots = (ctx as unknown as { slots: SlotsFace }).slots
    ;(ctx as unknown as { effect: (fn: () => () => void, label?: string) => void }).effect(() => installStyles(), 'dsh-code-highlight: styles')
    slots.inject(TOOLVIEW_SLOT, function* () {
        for (const key of MUTATION_TOOLS) {
            yield slots.register(
                {
                    name: TOOLVIEW_SLOT,
                    key,
                    priority: PRIORITY,
                    locale: 'conversation',
                    inject: (sessionId: string) => ({
                        stockView: (): StockView | undefined => {
                            const entry = nextEntry(slots.entries(TOOLVIEW_SLOT), key, MutationView)
                            if (entry === undefined) return undefined
                            return { Component: entry.component as StockView['Component'], injected: stockInjected(entry, sessionId) }
                        },
                    }),
                },
                MutationView,
            )
        }
    })
}
