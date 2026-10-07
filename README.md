# opencode-todowrite

OpenCode **V2** plugin: a session-scoped todo list, ported from V1's built-in
`todowrite` tool. The agent can write todos; the TUI shows them in the sidebar.

## Layout

```
.
├── index.ts    # server plugin: todowrite / todoread tools + /todo-list command
├── rpc.ts      # server RPC definition (list / save + updated event)
├── tui.tsx     # CLI plugin: sidebar panel + /todo-add /todo-done /todo-clear
└── package.json
```

The package exports:

- `.` → `index.ts` (server plugin)
- `./tui` → `tui.tsx` (CLI/TUI plugin)
- `./rpc` → `rpc.ts` (RPC descriptor)

## Install (as a local plugin)

Install dependencies:

```sh
cd /root/aispace/opencode_plugins
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

- `tui.tsx` mirrors the RPC descriptor inline instead of importing `./rpc.ts`.
  The TUI loader only remaps `@opencode/plugin/tui`, not `@opencode/plugin/rpc`,
  so a relative import would fail at read stage. Keep the two definitions in
  sync.
- Todo state is stored via the plugin's scoped storage (`ctx.storage`, key
  `todo:<sessionID>`), so each session has its own list.
