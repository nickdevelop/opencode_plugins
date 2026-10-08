# opencode-todowrite

OpenCode **V2** 插件：会话级 todo 列表（从 V1 内置 todowrite 移植）。agent 工具 `todowrite`/`todoread` + TUI 侧边栏面板与斜杠命令。

## 结构（最小化，勿扩散）

- `index.ts` — server 插件：注册 RPC handler、`todowrite`/`todoread` 工具、`/todo-list` 命令。todo 状态存 `ctx.storage`（key `todo:<sessionID>`）。
- `rpc.ts` — RPC 描述符（`list`/`save` 方法 + `updated` 事件），server 端引用。
- `tui.tsx` — CLI/TUI 插件源码：侧边栏 `Todos` 面板 + `/todo-add` `/todo-done` `/todo-clear`。
- `dist/tui.js` — `tui.tsx` 的预编译产物（`./tui` 导出指向它），**禁止手改**。
- `build-tui.mjs` — babel（`babel-preset-solid` universal + `@opentui/solid`、`@babel/preset-typescript`）编译 `tui.tsx → dist/tui.js`。

导出：`.` → `index.ts`，`./tui` → `dist/tui.js`，`./rpc` → `rpc.ts`。

## 命令

- `npm run build` — 编译 TUI 入口（也挂在 `prepare`，git/npm 安装时自动执行）
- `npm run typecheck` — `tsc --noEmit`（覆盖 `index.ts`/`rpc.ts`/`tui.tsx`，jsx 为 `preserve`）。**注意：HEAD 上本就有 13 个既有错误**（`tui.tsx` 缺 solid JSX 类型声明、`ctx.storage.set` 的 Json 类型），验证改动时以"与改动前基线 diff 无新增错误"为准，而非要求零错误。
- **无测试、无 lint**：验证靠 typecheck 基线对比 + 实际加载插件（见下）

## 关键坑（改动前必读）

1. **改完 `tui.tsx` 必须 `npm run build` 并把 `dist/tui.js` 一起提交。** OpenCode v2 只对 *不在* `node_modules` 下的 `.tsx/.jsx` 跑 solid babel；包安装的插件入口若发布 `.tsx`，Bun 会退回 React JSX 转译并报 `Cannot find package 'react'`。因此 `./tui` 只能指向预编译的 `.js`。
2. **不要添加 `react` 依赖**来"修复"上面的报错——React 运行时无法驱动 OpenTUI 的 solid reconciler，只会掩盖问题。
3. **RPC 描述符有两份，必须手动同步**：`rpc.ts` 与 `tui.tsx` 内联的 `TodoRpc`。TUI loader 只 remap `@opencode/plugin/tui`，不 remap `@opencode/plugin/rpc`，所以 `tui.tsx` 不能 import `./rpc.ts`（相对导入会在 read 阶段失败）。改任一处 schema/方法/事件时两边都要改。
4. **本地验证方式**：在某个 `opencode.jsonc` 的 `plugins` 里以绝对路径引用本仓库目录；改完插件后要 reload 并重启后台服务才生效。typecheck 通过 ≠ TUI 能加载，改 `tui.tsx` 后应实际重启验证。

## 约定

- 依赖版本全部精确锁定（无 `^`，见 `package.json` dependencies），新增依赖保持同样做法（devDependencies 除外）。
- todo 状态以完整列表**全量替换**写入（`save`/`todowrite` 均为整表覆盖），不做增量合并。
- 远程仓库：`git@github.com:nickdevelop/opencode_plugins.git`。
