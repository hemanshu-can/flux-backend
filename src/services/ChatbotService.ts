import { BadRequestError } from 'routing-controllers';
import { Service } from 'typedi';

import {
  createCustomerTool,
  previewCustomerTool,
  runCreateCustomerTool,
  runPreviewCustomerTool,
  runSearchCustomersTool,
  searchCustomersTool,
} from '../ai/CustomerTools';
import {
  createItemTool,
  previewItemTool,
  runCreateItemTool,
  runPreviewItemTool,
  runSearchItemsTool,
  searchItemsTool,
} from '../ai/ItemTools';
import { createOrderTool, previewOrderTool, runCreateOrderTool, runPreviewOrderTool } from '../ai/OrderTools';
import { runChatCompletion } from '../lib/openai';
import type { ChatMessageParam, ChatToolCall } from '../lib/openai';
import type { ChatMessage, ChatToolDefinition, ChatbotRequest, ChatbotResponse } from '../types/ai';

/**
 * The assistant's brief. It restates the rules the tool descriptions already
 * encode so the model applies them across tools: resolve names to ids first,
 * preview and confirm before writing, and ask the user rather than guess.
 */
const SYSTEM_PROMPT = `You are the assistant for Flux, a printing-business CRM. You help staff find and manage customers, catalogue items and orders.

You act through tools for searching and creating customers, items and orders. Follow these rules:
- Look things up before referring to them: use search_customers and search_items to turn a name into an id, and ask the user when a search returns nothing or several plausible matches.
- Preview before you create: call preview_customer, preview_item or preview_order first, show the details back, and wait for the user to confirm before calling the matching create tool. Never create anything in the same turn you first propose it.
- If a required detail is missing, ask the user a follow-up question. Never invent, guess or use placeholder values.
- Only say something was created if the create tool confirmed it. If a tool returns an error or a list of missing fields, explain it plainly and ask how to proceed.
- Reply in plain language and keep it brief. Do not mention tool names or raw record ids unless the user asks.`;

/** Answers to give when the model returns no text of its own. */
const FALLBACK_REPLY =
  "Sorry, I couldn't finish that request. Could you rephrase, or give me a little more detail?";

/**
 * How many model turns one request may take. A request that searches, previews
 * and then answers fits comfortably; the cap only stops a model that keeps
 * calling tools without ever answering.
 */
const MAX_TOOL_ROUNDS = 6;

/** Every tool the model may call, sent as the request's `tools` each round. */
const CHAT_TOOLS: ChatToolDefinition[] = [
  searchCustomersTool,
  createCustomerTool,
  previewCustomerTool,
  searchItemsTool,
  createItemTool,
  previewItemTool,
  createOrderTool,
  previewOrderTool,
];

/** What a tool executor is called with: the arguments the model produced. */
type ToolRunner = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * Narrows an executor to the dispatcher's uniform signature. Each executor
 * declares its own argument type (e.g. `{ query: string }`) while the dispatcher
 * only knows it holds some JSON object — the model-facing JSON Schema is what
 * keeps the two in agreement, so the cast is made deliberately here.
 */
function asRunner<T>(run: (args: T) => Promise<unknown>): ToolRunner {
  return run as unknown as ToolRunner;
}

/** Tool name -> executor. */
const TOOL_RUNNERS: Record<string, ToolRunner> = {
  search_customers: asRunner(runSearchCustomersTool),
  create_customer: asRunner(runCreateCustomerTool),
  preview_customer: asRunner(runPreviewCustomerTool),
  search_items: asRunner(runSearchItemsTool),
  create_item: asRunner(runCreateItemTool),
  preview_item: asRunner(runPreviewItemTool),
  create_order: asRunner(runCreateOrderTool),
  preview_order: asRunner(runPreviewOrderTool),
};

/**
 * The chatbot turn: takes the conversation the client has been keeping, drives
 * the model with the CRM tools attached, and executes whatever the model asks
 * for until it produces a reply. Conversations are not stored here — the client
 * sends the transcript back on every request.
 */
@Service()
export class ChatbotService {
  async chat(request: ChatbotRequest): Promise<ChatbotResponse> {
    const history = this.readHistory(request);

    // The system prompt the client never sees, followed by the client's turns.
    const conversation: ChatMessageParam[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const message = await runChatCompletion({ messages: conversation, tools: CHAT_TOOLS });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return respond(history, message.content);
      }

      // The API requires each tool call to be paired with a result, so the
      // assistant turn carrying the calls and one tool message per call are
      // appended before the next round.
      conversation.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });
      for (const call of message.tool_calls) {
        conversation.push(await this.executeToolCall(call));
      }
    }

    // Still calling tools after the cap: ask once more with no tools available,
    // which forces an answer in text rather than another round.
    const final = await runChatCompletion({ messages: conversation });
    return respond(history, final.content);
  }

  /**
   * Runs one tool call and returns the `tool` message to feed back. Problems —
   * malformed arguments, an unknown tool, an executor rejecting its input — are
   * returned as an `{ error }` payload rather than thrown, so the model can
   * explain them to the user or ask for the missing detail.
   */
  private async executeToolCall(call: ChatToolCall): Promise<ChatMessageParam> {
    if (call.type !== 'function') {
      return toolMessage(call.id, { error: `Unsupported tool call type "${call.type}".` });
    }

    const { name, arguments: rawArguments } = call.function;
    const runner = TOOL_RUNNERS[name];
    if (!runner) {
      return toolMessage(call.id, { error: `Unknown tool "${name}".` });
    }

    try {
      const args = parseToolArguments(rawArguments);
      return toolMessage(call.id, await runner(args));
    } catch (error) {
      return toolMessage(call.id, { error: describeError(error) });
    }
  }

  /**
   * Validates the conversation and rebuilds it as the turns the model is allowed
   * to see. Objects are rebuilt rather than passed through, and only user and
   * assistant roles are accepted, so a client cannot inject a system prompt or a
   * forged tool result.
   */
  private readHistory(request: ChatbotRequest): ChatMessage[] {
    const messages: unknown = request?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestError('"messages" must be a non-empty array of chat turns.');
    }

    return messages.map((message, index) => {
      const label = `messages[${index}]`;
      const { role, content } = readTurn(message);

      if (typeof content !== 'string' || content.trim() === '') {
        throw new BadRequestError(`"${label}.content" must be a non-empty string.`);
      }

      switch (role) {
        case 'user':
          return { role: 'user', content };
        case 'assistant':
          return { role: 'assistant', content };
        default:
          throw new BadRequestError(`"${label}.role" must be "user" or "assistant".`);
      }
    });
  }
}

/**
 * Builds the response: the reply, plus the client's transcript with that reply
 * appended so the client can keep the conversation going.
 */
function respond(history: ChatMessage[], content: string | null): ChatbotResponse {
  const reply = content?.trim() || FALLBACK_REPLY;
  return { reply, messages: [...history, { role: 'assistant', content: reply }] };
}

/** A `tool` message carrying one call's result back to the model. */
function toolMessage(toolCallId: string, result: unknown): ChatMessageParam {
  return { role: 'tool', tool_call_id: toolCallId, content: stringifyToolResult(result) };
}

/** Serializes a tool result; the API requires a string, so `undefined` becomes "null". */
function stringifyToolResult(result: unknown): string {
  return JSON.stringify(result) ?? 'null';
}

/** Parses the model's JSON arguments, insisting on a plain object. */
function parseToolArguments(raw: string): Record<string, unknown> {
  if (raw.trim() === '') {
    return {};
  }

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/** Reads `role` and `content` off an untrusted turn, whatever shape it arrived in. */
function readTurn(message: unknown): { role?: unknown; content?: unknown } {
  return typeof message === 'object' && message !== null
    ? (message as { role?: unknown; content?: unknown })
    : {};
}

/** A human-readable message for anything an executor might throw. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
