import { Plugin } from "@opencode/plugin"
import { TodoRpc } from "./rpc.js"

type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled"

interface TodoItem {
  content: string
  status: TodoStatus
  priority?: "low" | "medium" | "high"
}

const DESCRIPTION = [
  "Create and maintain a structured task list for the current coding session.",
  "Tracks progress, organizes multi-step work, and surfaces status to the user.",
  "",
  "When to use: task needs 3+ distinct steps; non-trivial work; user gave multiple tasks;",
  "new instructions arrive; starting a task (mark exactly ONE in_progress); finishing a task",
  "(mark completed only after real verification, add follow-ups discovered during work).",
  "",
  "Skip when: single straightforward task, purely informational request, tracking adds no value.",
  "",
  "States: pending, in_progress (exactly ONE at a time), completed, cancelled.",
  "Rules: update in real time, don't batch; keep one in_progress; if blocked, keep",
  "in_progress and add a follow-up describing the blocker; preserve user commands verbatim.",
].join("\n")

const key = (sessionID: string) => `todo:${sessionID}`

async function readTodos(
  storage: { get: (k: string) => Promise<unknown> },
  sessionID: string,
): Promise<TodoItem[]> {
  const raw = await storage.get(key(sessionID))
  return Array.isArray(raw) ? (raw as TodoItem[]) : []
}

export default Plugin.define({
  id: "todowrite",
  async setup(ctx) {
    const saveTodos = async (sessionID: string, todos: TodoItem[]) => {
      await ctx.storage.set(key(sessionID), todos)
      await registration.events.emit("updated", { sessionID })
      return todos
    }

    const registration = await ctx.rpc.register(TodoRpc, {
      list: async (input) => {
        const { sessionID } = input as { sessionID: string }
        return { todos: await readTodos(ctx.storage, sessionID) }
      },
      save: async (input) => {
        const { sessionID, todos } = input as {
          sessionID: string
          todos: TodoItem[]
        }
        return { todos: await saveTodos(sessionID, todos ?? []) }
      },
    })
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "todowrite",
        description: DESCRIPTION,
        input: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              description: "The updated todo list (full replacement)",
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
        execute: async (input, context) => {
          const todos = (input as { todos: TodoItem[] }).todos ?? []
          await saveTodos(context.sessionID, todos)
          const open = todos.filter((t) => t.status !== "completed").length
          return {
            content: `${open} todos\n` + JSON.stringify(todos, null, 2),
            metadata: { todos },
          }
        },
      })

      editor.add({
        name: "todoread",
        description: "Read the current session todo list.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async (_input, context) => {
          const todos = await readTodos(ctx.storage, context.sessionID)
          return { content: JSON.stringify(todos, null, 2), metadata: { todos } }
        },
      })
    })

    await ctx.command.transform((editor) => {
      editor.add({
        name: "todo-list",
        description: "Print this session's todo list (first 10).",
        execute: async ({ sessionID, prompt, delivery }) => {
          const todos = await readTodos(ctx.storage, sessionID)
          const head = todos.slice(0, 10)
          const lines = head.map(
            (t, i) =>
              `${i + 1}. [${t.status}]${t.priority ? ` (${t.priority})` : ""} ${t.content}`,
          )
          await ctx.session.prompt({
            ...prompt,
            sessionID,
            text: todos.length === 0 ? "Todo list is empty." : lines.join("\n"),
            delivery,
          })
        },
      })
    })
  },
})
