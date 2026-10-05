import OpenAI from 'openai';

/**
 * The app's single point of contact with the OpenAI API. Every other module
 * works through the wrapper below, so the SDK and its configuration stay here.
 *
 * Configuration comes from the environment:
 * - OPENAI_API_KEY:   required; the API key every request is billed to
 * - OPENAI_MODEL:     chat model to use (default "gpt-4o-mini")
 * - OPENAI_BASE_URL:  override the API base (default: OpenAI's own endpoint)
 * - OPENAI_TIMEOUT_MS: per-request timeout in milliseconds (default 30000)
 */

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
/** Upper bound on the tokens a single turn may generate. */
const MAX_TOKENS = 1024;

/** The SDK's message/tool types, re-exported so callers avoid importing the SDK. */
export type ChatMessageParam = OpenAI.ChatCompletionMessageParam;
export type ChatTool = OpenAI.ChatCompletionTool;
export type ChatToolCall = OpenAI.ChatCompletionMessageToolCall;

let client: OpenAI | undefined;

/**
 * Builds the shared client on first use. It is deliberately lazy: constructing
 * it at import time would throw when OPENAI_API_KEY is unset, and this module is
 * reached through app.ts -> controller -> service, so that would take the whole
 * server down on boot. Creating it per request keeps a missing key a failure of
 * the request that needed it instead.
 */
function getClient(): OpenAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to the environment before using the chatbot.',
    );
  }

  client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    timeout: readPositiveNumber(process.env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  });
  return client;
}

/** The chat model every request uses, from OPENAI_MODEL or the default. */
export function getChatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export interface ChatCompletionRequest {
  /** The full conversation, oldest first, including the system prompt. */
  messages: ChatMessageParam[];
  /** Tools the model may call. Omitted (or empty) disables tool calling. */
  tools?: ChatTool[];
}

/**
 * Runs one Chat Completions turn and returns the assistant message, which may
 * carry `tool_calls` the caller is expected to execute and feed back.
 */
export async function runChatCompletion({
  messages,
  tools,
}: ChatCompletionRequest): Promise<OpenAI.ChatCompletionMessage> {
  const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
    model: getChatModel(),
    messages,
    // `max_tokens`, not the newer `max_completion_tokens`: the deployment this
    // app talks to is DeepSeek's OpenAI-compatible endpoint (OPENAI_BASE_URL),
    // whose schema defines `max_tokens` and does not honour the OpenAI-only name.
    max_tokens: MAX_TOKENS,
  };

  // Only advertise the tools when there are some: an empty `tools` array is not
  // a valid request, and omitting it is how a text-only turn is requested.
  if (tools && tools.length > 0) {
    params.tools = tools;
    params.tool_choice = 'auto';
  }

  const completion = await getClient().chat.completions.create(params);
  return completion.choices[0].message;
}

/** Parses a positive number, falling back when the value is missing or unusable. */
function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
