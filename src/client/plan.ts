/**
 * Decide, per call, whether this plugin draws the card or leaves it to the
 * stock view. The plugin only takes over when there is something to
 * highlight; every other case renders exactly as DSH does today.
 */
import { MAX_HIGHLIGHT_ROWS, buildRows, diffsFor, rowState, type BlockLike, type DiffRow, type FileDiff, type MutationTool, type RowState } from './model.ts'

export type Plan =
    | { kind: 'stock'; reason: 'phase' | 'state' | 'no-diff' | 'unknown-language' | 'over-cap' }
    | { kind: 'own'; state: Extract<RowState, 'running' | 'ok'>; diffs: FileDiff[]; rows: DiffRow[]; languages: (string | undefined)[] }

/**
 * @param tool - wire tool name.
 * @param block - the call's current block.
 * @param languageOf - DSH's own path-to-language mapping (`languageForPath`).
 * @param cap - row count beyond which highlighting is skipped.
 */
export function planFor(tool: MutationTool, block: BlockLike, languageOf: (path: string) => string | undefined, cap = MAX_HIGHLIGHT_ROWS): Plan {
    const state = rowState(block)
    if (state === 'preparing') return { kind: 'stock', reason: 'phase' }
    if (state !== 'running' && state !== 'ok') return { kind: 'stock', reason: 'state' }
    const diffs = diffsFor(tool, block)
    if (diffs === null || diffs.length === 0) return { kind: 'stock', reason: 'no-diff' }
    const languages = diffs.map((diff) => languageOf(diff.path))
    if (languages.every((language) => language === undefined)) return { kind: 'stock', reason: 'unknown-language' }
    const rows = buildRows(diffs)
    if (rows.length > cap) return { kind: 'stock', reason: 'over-cap' }
    return { kind: 'own', state, diffs, rows, languages }
}
