# dsh-code-highlight

Syntax-highlighted diffs in the DeepSeek Harness chat's **edit / write / apply_patch** tool cards.

DSH already highlights `read` cards and the side-panel change review, but the chat's file-mutation
diff card renders every line as plain text. This client plugin re-renders those three cards with
DSH's **own** highlighter (`useCodeHighlighter(languageForPath(path))` from
`@deepseek-ai/dsh-client-ui-primitives`). It bundles no Shiki and no grammars: languages and colours
are exactly DSH's (`--shiki-*` theme tokens), so themes apply unchanged.

## Behaviour

- Each hunk's old side (context + removed) and new side (context + added) are tokenized separately,
  then mapped back onto the diff lines, as the official change review does.
- Highlighting starts only when the card is expanded and scrolled into view.
- The card otherwise matches the stock one: title, path link, `NKB` size, `+N −M`, language header
  with wrap/copy, 9-row fold, Inspect.
- These cases go to the **stock view, untouched**:
  - languages DSH does not map (unknown or missing extension; no shebang detection, which matches DSH);
  - diffs over 2000 rows;
  - preparing, failed or stopped calls;
  - nested PTC calls.
- Lines of 1000+ characters stay plain (DSH's own limit).

Registered in the keyed `tool.call.toolview` slot for `edit`, `write` and `apply_patch` only,
at priority −10. No Host service and no settings. User-visible strings reuse DSH's `conversation`
locale namespace, so no new strings are added.

## Compatibility

DSH 0.2.1-rc.5 and 0.2.2-rc.1. `npm run test:contract` checks the public `.d.ts` and exports of both
releases (fetched from npm) and fails if `tool.call.toolview`, `useCodeHighlighter`,
`languageForPath` or the reused primitives change shape. The GUI has only been verified on 0.2.2-rc.1.

## Develop

```sh
pnpm install
pnpm typecheck && pnpm test && pnpm test:contract
pnpm build
```
