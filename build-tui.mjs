// Precompile the TUI entry (tui.tsx) to plain JavaScript.
//
// Why this exists
// ---------------
// OpenCode v2's CLI/TUI plugin loader only runs `babel-preset-solid` on
// .tsx/.jsx source whose path is NOT under node_modules:
//
//   /^(?!.*[/\\]node_modules[/\\]).*\.[cm]?[jt]sx(?:[?#].*)?$/
//
// Plugins installed from a package (`github:` or `npm:`) live under
// node_modules, so their .tsx entry is served as-is. Bun then falls back to its
// default React JSX transpiler, which emits `react/jsx-runtime` imports, and the
// plugin fails to load with `Cannot find package 'react'`.
//
// Publishing a precompiled .js entry sidesteps the host filter entirely: the
// .js file needs no JSX transform, and its bare specifiers (`@opentui/solid`,
// `solid-js`, `@opencode/plugin/tui`) are remapped to the host's singletons by
// the runtime plugin. This mirrors the host's own transform:
//   babel-preset-solid ({ generate: "universal", moduleName: "@opentui/solid" })
//   + @babel/preset-typescript
// See @opentui/solid/scripts/solid-transform.js (transformSolidSource).
import { transformAsync } from "@babel/core"
import solid from "babel-preset-solid"
import ts from "@babel/preset-typescript"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = dirname(fileURLToPath(import.meta.url))
const src = resolve(root, "tui.tsx")
const out = resolve(root, "dist", "tui.js")

const code = await readFile(src, "utf8")
const result = await transformAsync(code, {
  filename: src,
  configFile: false,
  babelrc: false,
  presets: [
    [solid, { moduleName: "@opentui/solid", generate: "universal" }],
    [ts],
  ],
})
if (!result?.code) throw new Error(`babel produced no output for ${src}`)

await mkdir(dirname(out), { recursive: true })
await writeFile(out, result.code, "utf8")
console.log(`built ${out}`)
