/**
 * Pure models behind the highlighted file-mutation card: which diffs a call
 * shows, how those diffs flatten into rows, and how per-side highlight tokens
 * map back onto those rows. Nothing here touches React or the DSH runtime, so
 * every rule is unit-testable.
 */
import { structuredPatch } from 'diff'

/** The three wire tools this plugin re-renders. Everything else stays stock. */
export const MUTATION_TOOLS = ['edit', 'write', 'apply_patch'] as const
export type MutationTool = (typeof MUTATION_TOOLS)[number]

/** Rows beyond this count are left to the stock (plain) card. */
export const MAX_HIGHLIGHT_ROWS = 2000

/** Body rows shown before the middle folds, as in the stock chat diff card. */
export const CHAT_DIFF_MAX_LINES = 9

/** Same edit-graph bound the stock DiffBlock uses. */
const MAX_DIFF_EDIT_LENGTH = 256

/** One file change, the shape the stock DiffBlock renders (`DiffHunk`). */
export interface FileDiff {
    path: string
    oldText: string | null
    newText: string
}

/** Minimal structural view of the tool blocks this plugin reads. */
export interface BlockLike {
    readonly callId: string
    readonly parentCallId?: string | undefined
    readonly phase?: 'preparing' | 'start'
    readonly argsRaw?: string
    readonly kind?: 'tool-result'
    readonly call?: { name: string; argsRaw: string } | null
    readonly isError?: boolean
    readonly error?: { name: string; code: string; reason?: string } | undefined
    readonly meta?: unknown
}

export type RowState = 'running' | 'ok' | 'error' | 'stopped' | 'preparing'

/** Lifecycle state, read the same way the stock row reads it. */
export function rowState(block: BlockLike): RowState {
    if (block.kind !== 'tool-result') return block.phase === 'preparing' ? 'preparing' : 'running'
    if (block.error?.code === 'interrupted') return 'stopped'
    const meta = block.meta
    const stopped = typeof meta === 'object' && meta !== null && !Array.isArray(meta) && (meta as Record<string, unknown>).stopped === true
    return block.isError === true || stopped ? 'error' : 'ok'
}

/** Parsed object arguments of a dispatched or settled call; null otherwise. */
export function parsedArgs(block: BlockLike): Record<string, unknown> | null {
    const raw = block.kind === 'tool-result' ? block.call?.argsRaw : block.phase === 'start' ? block.argsRaw : undefined
    if (typeof raw !== 'string') return null
    try {
        const value: unknown = JSON.parse(raw)
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
    } catch {
        return null
    }
}

function intendedDiff(tool: MutationTool, args: Record<string, unknown> | null): FileDiff | null {
    if (args === null || tool === 'apply_patch') return null
    const path = args.file_path
    if (typeof path !== 'string' || path.trim() === '') return null
    if (tool === 'write') {
        return typeof args.content === 'string' ? { path, oldText: null, newText: args.content } : null
    }
    const { old_string: oldText, new_string: newText, replace_all: replaceAll } = args
    if (typeof oldText !== 'string' || typeof newText !== 'string') return null
    if (replaceAll !== undefined && typeof replaceAll !== 'boolean') return null
    return { path, oldText: oldText || null, newText }
}

function appliedDiffs(meta: unknown): FileDiff[] | 'empty' | null {
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null
    const diffs = (meta as Record<string, unknown>).diffs
    if (!Array.isArray(diffs)) return null
    if (diffs.length === 0) return 'empty'
    const out: FileDiff[] = []
    for (const hunk of diffs as unknown[]) {
        if (typeof hunk !== 'object' || hunk === null) return null
        const { path, oldText, newText } = hunk as Record<string, unknown>
        if (typeof path !== 'string') return null
        if (oldText !== null && typeof oldText !== 'string') return null
        if (typeof newText !== 'string') return null
        out.push({ path, oldText, newText })
    }
    return out
}

/** Absolute operation-time path recorded in result metadata, when present. */
export function recordedPath(meta: unknown): string | undefined {
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
    const value = (meta as Record<string, unknown>).path
    return typeof value === 'string' && isAbsolutePath(value) ? value : undefined
}

export function isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\')
}

/**
 * The diffs a root edit / write / apply_patch card shows, mirroring the stock
 * card: the intended diff while running, the applied `meta.diffs` once
 * settled (a write with empty metadata keeps its whole-file diff). Returns
 * null whenever the stock card would not draw a diff, so that case stays stock.
 */
export function diffsFor(tool: MutationTool, block: BlockLike): FileDiff[] | null {
    if (block.parentCallId !== undefined) return null
    const intended = intendedDiff(tool, parsedArgs(block))
    if (intended === null) {
        if (block.kind !== 'tool-result' || block.isError === true) return null
        const applied = appliedDiffs(block.meta)
        return applied === null || applied === 'empty' ? null : applied
    }
    if (block.kind !== 'tool-result') return [intended]
    if (block.isError === true) return null
    const applied = appliedDiffs(block.meta)
    if (applied === null || applied === 'empty') return tool === 'write' ? [intended] : null
    const path = recordedPath(block.meta)
    return applied.map((diff) => (diff.path === path ? { ...diff, path: intended.path } : diff))
}

export type RowKind = 'path' | 'gap' | 'del' | 'add' | 'context'

export interface DiffRow {
    kind: RowKind
    text: string
    /** Index of the hunk this row belongs to (path / gap rows: -1). */
    hunk: number
    /** Index of the file diff this row belongs to. */
    file: number
}

/** Split text into content lines; a single trailing newline is a terminator. */
export function contentLines(text: string): string[] {
    if (text === '') return []
    return (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
}

/** Local patches of one file change, with the stock DiffBlock's parameters. */
export function localHunks(diff: FileDiff): { lines: string[] }[] {
    const oldLines = contentLines(diff.oldText ?? '')
    const newLines = contentLines(diff.newText)
    const normalize = (lines: string[]) => lines.map((line) => `${line}\n`).join('')
    const patch = structuredPatch('', '', normalize(oldLines), normalize(newLines), undefined, undefined, {
        context: 3,
        maxEditLength: MAX_DIFF_EDIT_LENGTH,
    })
    return patch?.hunks ?? [{ lines: [...oldLines.map((line) => `-${line}`), ...newLines.map((line) => `+${line}`)] }]
}

/** Flatten file changes into display rows, exactly as the stock DiffBlock does. */
export function buildRows(diffs: readonly FileDiff[]): DiffRow[] {
    const rows: DiffRow[] = []
    let prevPath: string | undefined
    let hunkIndex = 0
    diffs.forEach((diff, file) => {
        rows.push(diff.path !== prevPath ? { kind: 'path', text: diff.path, hunk: -1, file } : { kind: 'gap', text: '⋯', hunk: -1, file })
        prevPath = diff.path
        localHunks(diff).forEach((hunk, index) => {
            if (index > 0) rows.push({ kind: 'gap', text: '⋯', hunk: -1, file })
            for (const line of hunk.lines) {
                if (line.startsWith('\\')) continue
                const kind: RowKind = line.startsWith('-') ? 'del' : line.startsWith('+') ? 'add' : 'context'
                rows.push({ kind, text: line.slice(1), hunk: hunkIndex, file })
            }
            hunkIndex += 1
        })
    })
    return rows
}

/** Plain-text copy of every row, the stock card's clipboard format. */
export function copyText(rows: readonly DiffRow[]): string {
    return rows
        .map((row) => {
            switch (row.kind) {
                case 'del':
                    return `- ${row.text}`
                case 'add':
                    return `+ ${row.text}`
                case 'context':
                    return `  ${row.text}`
                default:
                    return row.text
            }
        })
        .join('\n')
}

export interface Span {
    text: string
    style: Record<string, unknown>
}

/** A fragment highlighter: one token list per line, or undefined for plain text. */
export type Highlighter = (code: string) => Span[][] | undefined

/**
 * Highlight every hunk's old side (context + removed) and new side (context +
 * added) separately, as the official change review does, and map the tokens
 * back onto the rows. A row whose tokens are unavailable gets `undefined` and
 * renders as plain text.
 * @param rows - flattened rows.
 * @param highlighterFor - the highlighter for a row's file, or undefined for an unknown language.
 * @returns per-row token lists, aligned with `rows`.
 */
export function highlightRows(rows: readonly DiffRow[], highlighterFor: (file: number) => Highlighter | undefined): (Span[] | undefined)[] {
    const out: (Span[] | undefined)[] = rows.map(() => undefined)
    const byHunk = new Map<number, number[]>()
    rows.forEach((row, index) => {
        if (row.hunk < 0) return
        const list = byHunk.get(row.hunk)
        if (list === undefined) byHunk.set(row.hunk, [index])
        else list.push(index)
    })
    for (const indexes of byHunk.values()) {
        const first = rows[indexes[0]!]!
        const highlighter = highlighterFor(first.file)
        if (highlighter === undefined) continue
        const oldSide = indexes.filter((i) => rows[i]!.kind !== 'add')
        const newSide = indexes.filter((i) => rows[i]!.kind !== 'del')
        const assign = (side: number[], fromNew: boolean) => {
            if (side.length === 0) return
            const tokens = highlighter(side.map((i) => rows[i]!.text).join('\n'))
            if (tokens === undefined) return
            side.forEach((rowIndex, at) => {
                const row = rows[rowIndex]!
                // Context rows take the new side's tokens; removed rows the old side's.
                if (row.kind === 'context' && !fromNew) return
                out[rowIndex] = tokens[at] ?? undefined
            })
        }
        assign(oldSide, false)
        assign(newSide, true)
    }
    return out
}

/** Additions and deletions, counted the stock way. */
export function totals(diffs: readonly FileDiff[]): { added: number; removed: number } {
    let added = 0
    let removed = 0
    for (const diff of diffs) {
        for (const hunk of localHunks(diff)) {
            for (const line of hunk.lines) {
                if (line.startsWith('+')) added++
                if (line.startsWith('-')) removed++
            }
        }
    }
    return { added, removed }
}

/** Decoded input size in KB (UTF-16 units, rounded up), as the stock summary suffix shows it. */
export function contentKilobytes(args: Record<string, unknown> | null): number | null {
    if (args === null) return null
    const fields = ['content', 'old_string', 'new_string'].filter((key) => typeof args[key] === 'string')
    if (fields.length === 0) return null
    const chars = fields.reduce((sum, key) => sum + (args[key] as string).length, 0)
    return Math.ceil(chars / 1024)
}

/** Strip the workspace root from a rooted absolute path (display only). */
export function relativizeToCwd(text: string, cwd: string | undefined): string {
    if (cwd === undefined || cwd === '') return text
    const root = cwd.replace(/[/\\]+$/, '')
    if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1)
    return text
}

/** Abbreviate a POSIX home directory as `~`. */
export function abbreviateHome(path: string, home: string | undefined): string {
    if (home === undefined || home === '') return path
    if (/^[A-Za-z]:[/\\]/.test(path) || /^[A-Za-z]:[/\\]/.test(home)) return path
    const root = home.replace(/\/+$/, '')
    if (root === '' || root === '/') return path
    if (path.replace(/\/+$/, '') === root) return '~'
    if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`
    return path
}

/** First line of a model-supplied string. */
export function firstLine(text: string): string {
    const at = text.indexOf('\n')
    return at < 0 ? text : text.slice(0, at)
}
