import { defineConfig } from 'tsdown'

/** Host half: ESM. Client half: CJS wrapped for the Web shell's module loader. */
export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        outDir: 'dist',
        format: 'esm',
        dts: false,
        outExtensions: () => ({ js: '.js' }),
    },
    {
        entry: { client: 'src/client/index.ts' },
        outDir: 'dist',
        format: 'cjs',
        dts: false,
        clean: false,
        outExtensions: () => ({ js: '.js' }),
        // React and DSH's primitives (with its highlighter) come from the shell; only `diff` is bundled.
        deps: {
            neverBundle: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives', /^@deepseek-ai\/cordis/],
            alwaysBundle: ['diff'],
        },
        banner: 'window.__ModuleLoader__.load({\n  id: "dsh-code-highlight",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
        footer: '\n    return module.exports;\n  }\n});',
    },
])
