# opencode-todowrite

OpenCode **V2** plugin: a session-scoped todo list, ported from V1's built-in
`todowrite` tool. The agent can write todos; the TUI shows them in the sidebar.

## Layout

```
.
├── index.ts        # server plugin: todowrite / todoread tools + /todo-list command
├── rpc.ts          # server RPC definition (list / save + updated event)
├── tui.tsx         # CLI plugin source: sidebar panel + /todo-add /todo-done /todo-clear
├── dist/tui.js     # precompiled TUI entry (published; do not edit by hand)
├── build-tui.mjs   # compiles tui.tsx -> dist/tui.js (babel-preset-solid)
└── package.json
```

The package exports:

- `.` → `index.ts` (server plugin)
- `./tui` → `dist/tui.js` (precompiled CLI/TUI plugin)
- `./rpc` → `rpc.ts` (RPC descriptor)

## Install (as a local plugin)

Install dependencies:

```sh
cd /data/projects/opencode_plugins
npm install
```

Reference the project from an OpenCode config (`opencode.jsonc`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/root/aispace/opencode_plugins"]
}
```

OpenCode auto-loads the `./tui` export alongside the main plugin. Reload and
restart the background service after changing plugins.

## Usage

Agent tools:

- `todowrite` — replace the current session's todo list.
- `todoread` — read the current session's todo list.

Slash commands / palette:

- `/todo-add`, `/todo-done`, `/todo-clear` — dialog-driven edits shown in the
  sidebar under **Todos**.

Server-side ` /todo-list` prints the current session's list into the
conversation.

## Notes

- **TUI entry must stay precompiled.** OpenCode v2 only runs
  `babel-preset-solid` on `.tsx`/`.jsx` paths that are *not* under
  `node_modules`. Package-installed plugins (`github:` / `npm:`) live under
  `node_modules`, so shipping `tui.tsx` as the `./tui` entry makes the host fall
  back to Bun's default React JSX transpiler and fail with
  `Cannot find package 'react'`. `./tui` therefore points at the committed
  `dist/tui.js`. After editing `tui.tsx`, run `npm run build` (also wired to
  `prepare`, so git installs rebuild automatically) and commit `dist/tui.js`.
  Do **not** add a `react` dependency — a React runtime cannot drive OpenTUI's
  Solid reconciler and would only hide the error.
- `tui.tsx` mirrors the RPC descriptor inline instead of importing `./rpc.ts`.
  The TUI loader only remaps `@opencode/plugin/tui`, not `@opencode/plugin/rpc`,
  so a relative import would fail at read stage. Keep the two definitions in
  sync.
- Todo state is stored via the plugin's scoped storage (`ctx.storage`, key
  `todo:<sessionID>`), so each session has its own list.
