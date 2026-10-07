import { createSignal, onCleanup, onMount, For, Show } from "solid-js"
import { Plugin, usePlugin } from "@opencode/plugin/tui"

// RPC descriptor mirrored from ./rpc.ts (server side registers it).
// Inlined here because the TUI loader only remaps `@opencode/plugin/tui`;
// a relative import of ./rpc.js would pull `@opencode/plugin/rpc` and fail at read stage.
const TodoRpc = {
  id: "todowrite",
  methods: {
    list: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed", "cancelled"],
                },
                priority: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["content", "status"],
              additionalProperties: false,
            },
          },
        },
        required: ["todos"],
        additionalProperties: false,
      },
    },
    save: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          todos: { type: "array" },
        },
        required: ["sessionID", "todos"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { todos: { type: "array" } },
        required: ["todos"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: {
      schema: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
    },
  },
} as const

interface TodoItem {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority?: "low" | "medium" | "high"
}

const MARK: Record<TodoItem["status"], string> = {
  pending: "[ ]",
  in_progress: "[~]",
  completed: "[x]",
  cancelled: "[-]",
}

function TodoPanel(props: { sessionID: string }) {
  const context = usePlugin()
  const rpc = context.client.rpc(TodoRpc)
  const [todos, setTodos] = createSignal<TodoItem[]>([])

  const refresh = async () => {
    try {
      const res = (await rpc.list(
        { sessionID: props.sessionID },
        { location: context.location },
      )) as {
        todos: TodoItem[]
      }
      setTodos(res.todos ?? [])
    } catch {
      setTodos([])
    }
  }

  onMount(() => void refresh())
  const off = rpc.events.on("updated", (event) => {
    const data = event.data as { sessionID?: string }
    if (data.sessionID === props.sessionID) void refresh()
  })
  onCleanup(off)

  const open = () => todos().filter((t) => t.status !== "completed").length

  return (
    <box flexDirection="column">
      <text>{`Todos (${open()}/${todos().length})`}</text>
      <Show when={todos().length === 0}>
        <text dim>No todos yet.</text>
      </Show>
      <For each={todos().slice(0, 10)}>
        {(todo) => <text>{`${MARK[todo.status]} ${todo.content}`}</text>}
      </For>
    </box>
  )
}

export default Plugin.define({
  id: "todowrite-tui",
  setup(context) {
    const rpc = context.client.rpc(TodoRpc)

    const activeSessionID = (): string | undefined => {
      const route = context.ui.router.current()
      if (route.type === "session") return route.sessionID
      return context.ui.tabs.list().find((t) => t.active)?.sessionID
    }

    const withTodos = async (
      fn: (sessionID: string, todos: TodoItem[]) => Promise<TodoItem[] | undefined>,
    ) => {
      const sessionID = activeSessionID()
      if (!sessionID) {
        await context.ui.toast.show({ message: "No active session", variant: "error" })
        return
      }
      const res = (await rpc.list(
        { sessionID },
        { location: context.location },
      )) as { todos: TodoItem[] }
      const next = await fn(sessionID, res.todos ?? [])
      if (next) await rpc.save({ sessionID, todos: next }, { location: context.location })
    }

    context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <TodoPanel sessionID={sessionID} />,
    })

    // keymap.layer must run inside a component (it needs Keymap.Provider),
    // so register it from an `app` slot render instead of setup directly.
    context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "todowrite.add",
              title: "Todo: add item",
              group: "Todo",
              palette: true,
              slash: { name: "todo-add" },
              run: async () => {
                const content = await context.ui.dialog.prompt({
                  title: "Add todo",
                  placeholder: "What needs doing?",
                })
                if (!content) return
                await withTodos(async (_id, todos) => [
                  ...todos,
                  { content, status: "pending" as const },
                ])
              },
            },
            {
              id: "todowrite.done",
              title: "Todo: mark done",
              group: "Todo",
              palette: true,
              slash: { name: "todo-done" },
              run: async () => {
                const sessionID = activeSessionID()
                if (!sessionID) return
                const res = (await rpc.list(
                  { sessionID },
                  { location: context.location },
                )) as { todos: TodoItem[] }
                const open = res.todos ?? []
                if (open.length === 0) {
                  await context.ui.toast.show({ message: "Todo list is empty" })
                  return
                }
                const picked = await context.ui.dialog.select({
                  title: "Mark done",
                  options: open.map((t, i) => ({
                    title: `${MARK[t.status]} ${t.content}`,
                    value: i,
                  })),
                })
                if (picked === undefined) return
                await rpc.save(
                  {
                    sessionID,
                    todos: open.map((t, i) =>
                      i === picked ? { ...t, status: "completed" as const } : t,
                    ),
                  },
                  { location: context.location },
                )
              },
            },
            {
              id: "todowrite.clear",
              title: "Todo: clear list",
              group: "Todo",
              palette: true,
              slash: { name: "todo-clear" },
              run: async () => {
                const sessionID = activeSessionID()
                if (!sessionID) return
                const ok = await context.ui.dialog.confirm({
                  title: "Clear todos?",
                  message: "Remove all todos in this session?",
                  label: { confirm: "Clear", cancel: "Cancel" },
                })
                if (ok) await rpc.save({ sessionID, todos: [] }, { location: context.location })
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
