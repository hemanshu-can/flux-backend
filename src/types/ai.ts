/**
 * Contracts for the OpenAI function tools under src/ai.
 *
 * These mirror the shape the OpenAI Chat Completions API expects for a `tools`
 * entry (https://platform.openai.com/docs/api-reference/chat). They are kept as
 * local structural types rather than the SDK's so the tool definitions stay
 * decoupled from the SDK version; the one place the SDK is touched is
 * src/lib/openai.ts, and the two shapes are compatible where they meet.
 */

/** A single function tool the model may call. */
export interface ChatToolFunctionDefinition {
  name: string;
  description: string;
  /** JSON Schema for the function arguments. */
  parameters: Record<string, unknown>;
}

/** A `tools` entry: the function dialect tag wrapping its definition. */
export interface ChatToolDefinition {
  type: 'function';
  function: ChatToolFunctionDefinition;
}

/**
 * A turn in a chatbot conversation. Only these two roles cross the HTTP
 * boundary: the client owns the transcript and sends it back each turn, and the
 * server supplies the system prompt itself. Discriminated on `role` so a
 * `ChatMessage` maps cleanly onto the OpenAI message params.
 */
export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

/** Body of POST /api/v1/chatbot — the conversation so far, oldest turn first. */
export interface ChatbotRequest {
  messages: ChatMessage[];
}

/**
 * Response of POST /api/v1/chatbot. `reply` is the assistant's answer this turn;
 * `messages` is the client's conversation with that answer appended, ready to be
 * stored and sent back on the next turn. Tool calls and their output are an
 * implementation detail of the turn and are not echoed back.
 */
export interface ChatbotResponse {
  reply: string;
  messages: ChatMessage[];
}
