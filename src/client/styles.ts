/**
 * Styles mirroring the stock chat tool row and diff card (`ToolRow`,
 * `CodeCard`, `DiffBlock` in DSH's public primitives), using only DSH's
 * public CSS custom properties. Token colours come from DSH's own
 * `--shiki-*` variables through the highlighter's inline styles.
 */
export const STYLE_ID = 'dsh-code-highlight'

export const CSS = `
.dch-root{flex-direction:column;display:flex}
.dch-leading{flex-shrink:0}
.dch-title{font-weight:400}
.dch-sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}
.dch-summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}
.dch-suffix{white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;margin-left:4px}
.dch-diffStat{font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);margin-left:10px;transform:translateY(.5px)}
.dch-row[aria-expanded=true] .dch-added{color:var(--dsw-alias-state-success-primary)}
.dch-row[aria-expanded=true] .dch-removed{color:var(--dsw-alias-state-error-primary)}
@media (hover:hover){.dch-row:hover .dch-added{color:var(--dsw-alias-state-success-primary)}.dch-row:hover .dch-removed{color:var(--dsw-alias-state-error-primary)}}
.dch-fileLink{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:inherit;text-align:left;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;text-underline-offset:3px;cursor:pointer;background:0 0;border:none;flex:0 auto;margin:0;padding:0;text-decoration:underline 1px dotted;overflow:hidden}
.dch-bodyWrap{flex-direction:column;display:flex}
.dch-inspect{border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}
.dch-inspect:focus-visible{opacity:1}
@media (hover:hover){.dch-root:hover .dch-inspect{opacity:1}.dch-inspect:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}}
@media (hover:none){.dch-inspect{opacity:1}}
.dch-hidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}

.dch-card{position:relative;margin:4px 0 4px 4px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-markdown-code-block);border-radius:var(--dsw-radius-lg);font:var(--dsw-font-markdown-code-block);overflow:hidden}
.dch-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px 8px 22px;background:var(--dsl-code-block-background,var(--dsw-alias-markdown-code-block));border-top-left-radius:inherit;border-top-right-radius:inherit;color:var(--dsw-alias-label-secondary);font:11px/18px var(--dsw-font-family)}
.dch-heading{display:flex;align-items:baseline;gap:12px;min-width:0}
.dch-language{color:var(--dsw-alias-label-tertiary);flex:none;font-family:var(--ds-font-family-code)}
.dch-actions{display:flex;align-items:center;gap:4px;flex:none}
.dch-action{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer}
@media (hover:hover){.dch-action:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.dch-action:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dch-body{display:grid;grid-template-columns:minmax(max-content,1fr);padding:6px 0 20px;font:var(--dsw-font-markdown-code-block);overflow-x:auto}
.dch-line{box-sizing:border-box;min-height:1lh;padding:0 22px;white-space:pre}
.dch-card[data-code-wrap='true'] .dch-body{grid-template-columns:minmax(0,1fr)}
.dch-card[data-code-wrap='true'] .dch-line{white-space:pre-wrap;overflow-wrap:anywhere}
.dch-path{color:var(--dsw-alias-label-secondary);font-weight:500}
.dch-gap{color:var(--dsw-alias-label-tertiary)}
.dch-del::before{content:'- ';color:var(--dsw-alias-state-error-primary)}
.dch-del{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-code-diff-deleted);box-shadow:inset 3px 0 0 var(--dsw-alias-state-error-primary)}
.dch-add::before{content:'+ ';color:var(--dsw-alias-state-success-primary)}
.dch-add{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-code-diff-added);box-shadow:inset 3px 0 0 var(--dsw-alias-state-success-primary)}
.dch-context{color:var(--dsw-alias-label-secondary)}
.dch-context::before{content:'  '}
.dch-line[data-highlighted]{color:var(--shiki-foreground,var(--dsw-alias-label-primary))}
.dch-expand{display:block;width:100%;padding:0 22px;border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;text-align:left}
@media (hover:hover){.dch-expand:hover{color:var(--dsw-alias-label-secondary)}}
`

/** Install the stylesheet once per document; returns a remover. */
export function installStyles(doc: Document | undefined = globalThis.document): () => void {
    if (doc === undefined) return () => {}
    if (doc.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {}
    const tag = doc.createElement('style')
    tag.dataset.plugin = STYLE_ID
    tag.dataset.pluginCss = STYLE_ID
    tag.textContent = CSS
    doc.head.appendChild(tag)
    return () => {
        tag.remove()
    }
}
