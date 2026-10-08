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
  "## When to use",
  "Use proactively when:",
  "- The task requires 3+ distinct steps or actions (not just 3 tool calls for a single conceptual step)",
  "- The work is non-trivial and benefits from planning",
  "- The user provides multiple tasks (numbered or comma-separated) or explicitly asks for a todo list",
  "- New instructions arrive - capture them as todos",
  "- You start a task - mark it `in_progress` (only one at a time) before working",
  "- You finish a task - mark it `completed` and add any follow-ups discovered during the work",
  "",
  "## When NOT to use",
  "Skip when:",
  "- The work is a single, straightforward task (or <3 trivial steps)",
  "- The request is purely informational or conversational",
  "- Tracking adds no organizational value",
  "",
  "## States",
  "- `pending` - not started",
  "- `in_progress` - actively working (exactly ONE at a time)",
  "- `completed` - finished successfully",
  "- `cancelled` - no longer needed",
  "",
  "## Rules",
  "- Update status in real time; don't batch completions",
  "- Mark `completed` only after the required work is actually done, including any required verification. Never based on intent.",
  "- Keep exactly one `in_progress` while work remains",
  "- If blocked or partial, keep it `in_progress` and add a follow-up todo describing the blocker",
  "- Preserve user-provided commands verbatim (flags, args, order)",
  "- Items should be specific and actionable; break large work into smaller steps",
  "",
  "When in doubt, use it.",
].join("\n")

const TASK_MANAGEMENT = [
  "# Task Management",
  "You have access to the todowrite tool to help you manage and plan tasks. Use it VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.",
  "It is also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.",
  "",
  "It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.",
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

    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: TASK_MANAGEMENT })
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
          const done = todos.filter((t) => t.status === "completed").length
          return {
            content:
              `Completed ${done}/${todos.length} todos\n` + JSON.stringify(todos, null, 2),
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
