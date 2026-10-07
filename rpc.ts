import { Rpc } from "@opencode/plugin/rpc"

// NOTE: keep in sync with the inline copy in ./tui.tsx (the TUI loader only
// remaps `@opencode/plugin/tui`, so tui.tsx cannot import this file).

const TodoItemSchema = {
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
} as const

const SessionInput = {
  type: "object",
  properties: { sessionID: { type: "string" } },
  required: ["sessionID"],
  additionalProperties: false,
} as const

export const TodoRpc = Rpc.define({
  id: "todowrite",
  methods: {
    list: {
      input: SessionInput,
      output: {
        type: "object",
        properties: { todos: { type: "array", items: TodoItemSchema } },
        required: ["todos"],
        additionalProperties: false,
      },
    },
    save: {
      input: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          todos: { type: "array", items: TodoItemSchema },
        },
        required: ["sessionID", "todos"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { todos: { type: "array", items: TodoItemSchema } },
        required: ["todos"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: {
      schema: SessionInput,
    },
  },
})
