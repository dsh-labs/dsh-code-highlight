/**
 * The highlighted edit / write / apply_patch card. It draws the same row and
 * diff card as the stock view, but feeds each hunk side through DSH's own
 * `useCodeHighlighter`. Cases with nothing to highlight are handed back to
 * the stock view untouched.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
    DisclosureRow,
    IconCheckOutlineRegular,
    IconCopyOutlineRegular,
    IconEditOutlineRegular,
    IconInspectOutlineRegular,
    IconNowrapFillRegular,
    IconWrapFillRegular,
    TextShimmer,
    Tooltip,
    languageForPath,
    useCodeHighlighter,
    writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
    CHAT_DIFF_MAX_LINES,
    abbreviateHome,
    contentKilobytes,
    copyText,
    firstLine,
    highlightRows,
    isAbsolutePath,
    parsedArgs,
    recordedPath,
    relativizeToCwd,
    totals as countTotals,
    type BlockLike,
    type DiffRow,
    type FileDiff,
    type Highlighter,
    type MutationTool,
    type Span,
} from './model.ts'
import { planFor } from './plan.ts'

type Translate = (key: string, params?: Record<string, unknown>) => string

/** The subset of the public `ToolCallViewProps` this view reads. */
export interface MutationViewProps {
    toolName: string
    phase: 'preparing' | 'start' | 'result'
    block: BlockLike
    cwd?: string | undefined
    home?: string | undefined
    sessionId?: string
    openFile: (path: string, options?: { line?: number }) => void
    inspect?: (() => void) | undefined
    useDisclosure: () => { expanded: boolean; toggle: () => void }
    t: Translate
    /** Present when DSH's context-menu plugin is composed. */
    useContextMenu?: () => { getTriggerProps: (target?: () => unknown) => Record<string, unknown> | undefined }
    resolveFilePath?: (path: string) => string
    /** Injected by this plugin: the view DSH would render without it. */
    stockView: () => StockView | undefined
}

export interface StockView {
    Component: ComponentType<Record<string, unknown>>
    injected: Record<string, unknown>
}

const TITLE_KEYS: Record<MutationTool, string> = {
    edit: 'tool.title.edit',
    write: 'tool.title.write',
    apply_patch: 'tool.title.applyPatch',
}

const EDIT_ICON = <IconEditOutlineRegular size={14} />

/** Render the stock view with exactly the props it would have received. */
function Stock({ props }: { props: MutationViewProps }) {
    const stock = props.stockView()
    if (stock === undefined) return null
    const { stockView: _omit, ...rest } = props
    return <stock.Component {...(rest as unknown as Record<string, unknown>)} {...stock.injected} />
}

export const MutationView = memo(function MutationView(props: MutationViewProps) {
    const tool = props.toolName as MutationTool
    const plan = useMemo(() => planFor(tool, props.block, languageForPath), [tool, props.block])
    if (plan.kind === 'stock') return <Stock props={props} />
    return <OwnRow props={props} tool={tool} state={plan.state} diffs={plan.diffs} rows={plan.rows} languages={plan.languages} />
})

interface OwnRowProps {
    props: MutationViewProps
    tool: MutationTool
    state: 'running' | 'ok'
    diffs: FileDiff[]
    rows: DiffRow[]
    languages: (string | undefined)[]
}

function OwnRow({ props, tool, state, diffs, rows, languages }: OwnRowProps) {
    const { block, cwd, home, t, openFile, inspect } = props
    const { expanded, toggle } = props.useDisclosure()
    const menu = props.useContextMenu?.()
    const args = useMemo(() => parsedArgs(block), [block])
    const argPath = tool === 'apply_patch' ? undefined : typeof args?.file_path === 'string' && args.file_path !== '' ? firstLine(args.file_path) : undefined
    const summary = argPath === undefined ? '' : abbreviateHome(relativizeToCwd(argPath, cwd), home)
    const settled = block.kind === 'tool-result'
    const recorded = settled ? recordedPath(block.meta) : undefined
    const filePath = argPath === undefined ? undefined : recorded ?? (isAbsolutePath(argPath) || (settled && block.parentCallId === undefined) ? argPath : undefined)
    const kilobytes = tool === 'apply_patch' ? null : contentKilobytes(args)
    const suffix = kilobytes !== null && summary !== '' ? t('tool.preparing.content', { kilobytes }) : null
    const stat = useMemo(() => countTotals(diffs), [diffs])
    const running = state === 'running'

    const onOpen = useMemo(
        () =>
            filePath === undefined
                ? undefined
                : (event: { stopPropagation: () => void }) => {
                      event.stopPropagation()
                      openFile(filePath)
                  },
        [filePath, openFile],
    )
    const menuProps =
        menu !== undefined && argPath !== undefined
            ? menu.getTriggerProps(() => ({ kind: 'file', value: { sessionId: props.sessionId, path: props.resolveFilePath?.(argPath) ?? argPath } }))
            : undefined

    const collapsed: ReactNode = summary !== '' || stat !== null ? (
        <>
            {summary !== '' && <span className="dch-sep" data-shimmer-decoration aria-hidden />}
            {summary !== '' &&
                (onOpen !== undefined ? (
                    <button
                        type="button"
                        className="dch-fileLink"
                        {...menuProps}
                        onClick={onOpen}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
                            ;(menuProps?.onKeyDown as ((e: unknown) => void) | undefined)?.(event)
                        }}
                    >
                        <TextShimmer>{summary}</TextShimmer>
                    </button>
                ) : (
                    <span className="dch-summary">
                        <TextShimmer>{summary}</TextShimmer>
                    </span>
                ))}
            {suffix !== null && <TextShimmer className="dch-suffix">{suffix}</TextShimmer>}
            <TextShimmer className="dch-suffix dch-diffStat">
                <span className="dch-added">{`+${stat.added}`}</span> <span className="dch-removed">{`-${stat.removed}`}</span>
            </TextShimmer>
        </>
    ) : null

    return (
        <div className="dch-root" data-variant={tool === 'write' ? 'write' : 'edit'} data-tool={tool} data-state={state} data-code-highlight="">
            {running && <span className="dch-hidden">{t('row.running')}</span>}
            <DisclosureRow
                rowClassName="dch-row"
                leadingClassName="dch-leading"
                titleClassName="dch-title"
                icon={EDIT_ICON}
                title={t(TITLE_KEYS[tool])}
                running={running}
                open={expanded}
                expandable
                expandOnRowClick
                keepContentWhenOpen
                onToggle={toggle}
                collapsedContent={collapsed}
            >
                {expanded ? (
                    <div className="dch-bodyWrap">
                        <HighlightedDiff key={languages.join('\u0000')} rows={rows} languages={languages} t={t} />
                        {inspect !== undefined && (
                            <button type="button" className="dch-inspect" onClick={inspect}>
                                <IconInspectOutlineRegular />
                                {t('row.inspect')}
                            </button>
                        )}
                    </div>
                ) : undefined}
            </DisclosureRow>
        </div>
    )
}

/** Call `useCodeHighlighter` once per distinct language; the list is fixed for a mounted card (the caller keys on it). */
function useHighlighters(languages: (string | undefined)[]): (file: number) => Highlighter | undefined {
    const distinct = useMemo(() => [...new Set(languages.filter((language): language is string => language !== undefined))], [languages])
    const highlighters: Highlighter[] = []
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed length per mount (keyed by the language list)
    for (const language of distinct) highlighters.push(useCodeHighlighter(language) as unknown as Highlighter)
    return useCallback(
        (file: number) => {
            const language = languages[file]
            if (language === undefined) return undefined
            return highlighters[distinct.indexOf(language)]
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [languages, distinct, ...highlighters],
    )
}

/** True once the element has been in the viewport (or immediately without IntersectionObserver). */
function useSeen(ref: { current: Element | null }): boolean {
    const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
    useEffect(() => {
        if (seen || ref.current === null) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setSeen(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px 0px' },
        )
        observer.observe(ref.current)
        return () => {
            observer.disconnect()
        }
    }, [seen, ref])
    return seen
}

interface HighlightedDiffProps {
    rows: DiffRow[]
    languages: (string | undefined)[]
    t: Translate
}

export function HighlightedDiff({ rows, languages, t }: HighlightedDiffProps) {
    const bodyRef = useRef<HTMLDivElement>(null)
    const seen = useSeen(bodyRef)
    const highlighterFor = useHighlighters(languages)
    const tokens = useMemo(() => (seen ? highlightRows(rows, highlighterFor) : rows.map(() => undefined)), [seen, rows, highlighterFor])
    const [unfolded, setUnfolded] = useState(false)
    const [wrapped, setWrapped] = useState(false)
    const [copied, setCopied] = useState(false)
    const first = languages[0]
    const commonLanguage = languages.every((language) => language === first) ? first : undefined
    const onCopy = useCallback(() => {
        if (copied) return
        void writeClipboard(copyText(rows)).then((ok: boolean) => {
            if (!ok) return
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1000)
        })
    }, [copied, rows])

    const maxLines = CHAT_DIFF_MAX_LINES
    const hidden = rows.length - maxLines
    const capped = hidden > 0 && !unfolded
    const headCount = Math.ceil(maxLines / 2)
    const tailCount = maxLines - headCount
    const indexes = rows.map((_, index) => index)
    const head = capped ? indexes.slice(0, headCount) : indexes
    const tail = capped ? indexes.slice(rows.length - tailCount) : []
    const line = (index: number) => {
        const row = rows[index]!
        const spans = tokens[index]
        return (
            <div key={index} className={`dch-line dch-${row.kind}`} data-highlighted={spans !== undefined ? '' : undefined}>
                {spans === undefined ? row.text : spans.map((span: Span, at: number) => <span key={at} style={span.style}>{span.text}</span>)}
            </div>
        )
    }
    const copyLabel = copied ? t('copied') : t('copy')
    const wrapLabel = wrapped ? t('codeBlock.unwrap') : t('codeBlock.wrap')
    return (
        <div className="dch-card" data-diff="" data-code-wrap={wrapped}>
            <div className="dch-header" data-code-block-banner>
                <div className="dch-heading">
                    <span className="dch-language">{commonLanguage ?? t('codeBlock.title')}</span>
                </div>
                <div className="dch-actions">
                    <Tooltip label={wrapLabel} side="top" portal>
                        <button type="button" className="dch-action" aria-label={t('codeBlock.wrap')} aria-pressed={wrapped} onClick={() => setWrapped((value) => !value)}>
                            {wrapped ? <IconNowrapFillRegular size={14} /> : <IconWrapFillRegular size={14} />}
                        </button>
                    </Tooltip>
                    <Tooltip label={copyLabel} side="top" portal>
                        <button type="button" className="dch-action" aria-label={copyLabel} onClick={onCopy}>
                            {copied ? <IconCheckOutlineRegular size={14} /> : <IconCopyOutlineRegular size={14} />}
                        </button>
                    </Tooltip>
                </div>
            </div>
            <div ref={bodyRef} className="dch-body">
                {head.map(line)}
                {hidden > 0 && (
                    <button
                        type="button"
                        className="dch-expand"
                        aria-expanded={unfolded}
                        aria-label={unfolded ? t('diff.collapseAria') : t('diff.expandAria', { count: hidden })}
                        onClick={() => setUnfolded((value) => !value)}
                    >
                        {unfolded ? t('collapse') : t('diff.expandRest', { count: hidden })}
                    </button>
                )}
                {tail.map(line)}
            </div>
        </div>
    )
}
