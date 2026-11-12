# dsh-code-highlight

Syntax-highlighted diffs in the DeepSeek Harness chat's **edit / write / apply_patch** tool cards.

DSH already highlights `read` cards and the side-panel change review, but the chat's file-mutation
diff card renders every line as plain text. This client plugin re-renders those three cards with
DSH's **own** highlighter (`useCodeHighlighter(languageForPath(path))` from
`@deepseek-ai/dsh-client-ui-primitives`). It bundles no Shiki and no grammars, so languages and
colours are exactly DSH's (`--shiki-*` theme tokens) and themes apply unchanged.

## Install

```sh
dsh plugin --profile desktop add dsh-code-highlight
```

Restart DSH, or reload the window, after installing. For the browser profile, use `--profile web`.

## What it does

- Each hunk's old side (context + removed lines) and new side (context + added lines) is tokenized
  separately, then the tokens are mapped back onto the diff lines, the same way the official
  change review does it.
- Highlighting starts only when a card is expanded and scrolled into view.
- The card otherwise matches the stock one: title, path link, `NKB` size, `+N −M`, language header
  with wrap/copy, 9-row fold, Inspect.
- Registered in the keyed `tool.call.toolview` slot for `edit`, `write` and `apply_patch` only, at
  priority −10. No Host service and no settings. Card text reuses DSH's `conversation` locale
  strings.

## Limits

Inherited from DSH, deliberately not worked around:

- Languages are chosen by **file extension only**, using DSH's table. There is no shebang
  detection, so an extension-less script such as `deploy` stays plain.
- Lines of 1000 or more characters stay plain.

One row differs from the stock card on purpose: the collapsed `apply_patch` row shows only the
`+N −M` totals. Stock names the patched files there, and since DSH 0.2.2-rc.2 it links each file of a
multi-file patch individually; this card names the files once it is expanded instead.

Cases that render with the **stock card, unchanged**:

- languages DSH does not map;
- diffs over 2000 rows;
- preparing, failed or stopped calls;
- calls nested inside a PTC program.

## Compatibility

| DSH | Status |
|---|---|
| 0.2.2-rc.2 | Contract-checked against its public npm packages; not verified in the GUI |
| 0.2.2-rc.1 | Contract-checked; verified in the GUI |
| 0.2.1-rc.5 | Contract-checked against its public npm packages; not verified in the GUI |

`node scripts/contract.mjs` downloads the public packages of all three releases from npm. It fails if
`tool.call.toolview`, `useCodeHighlighter`, `languageForPath` or the reused primitives change shape.

## Develop

```sh
pnpm install --frozen-lockfile
pnpm run typecheck && pnpm run build && pnpm test
node scripts/contract.mjs          # public DSH contracts
scripts/check-reproducible.sh      # two clean builds must be byte-identical
```

## Release

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on pull requests. Pushing a `v*` tag
runs `.github/workflows/release.yml`, which:

1. checks that the tag equals the `package.json` version;
2. checks that `.github/release-notes/<tag>.md` exists with `## Highlights`,
   `## Breaking changes`, `## Fixes` and `## Compatibility`;
3. runs the same checks as CI;
4. publishes to npm with provenance, under `next` for prerelease versions and `latest` otherwise;
5. creates a GitHub Release with the packed tgz attached.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
