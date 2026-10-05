import { Container } from 'typedi';

import { ItemService } from '../services/ItemService';
import type { ChatToolDefinition } from '../types/ai';
import type { CreateItemRequest, ItemResponse } from '../types/item';

/**
 * `search_items` — lets the model resolve a catalogue item by free text before
 * it needs an id (to price a quotation or build an order). Matches partially
 * and case-insensitively against the item name.
 */
export const searchItemsTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'search_items',
    description:
      'Search the item catalogue by free text. Matches partially and ' +
      'case-insensitively against the item name. Returns every matching item; ' +
      'an empty array means no match.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full or partial item name to look up.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * Executes `search_items` by delegating to ItemService, which owns the Mongo
 * name query. Call this with the parsed arguments object the model returns on
 * a tool call.
 */
export async function runSearchItemsTool(args: { query: string }): Promise<ItemResponse[]> {
  const itemService = Container.get(ItemService);
  return itemService.searchItems(args.query);
}

/**
 * The required details `create_item` cannot proceed without. If the user has
 * not supplied one of these, the model should ask a follow-up question rather
 * than inventing a value.
 */
const REQUIRED_ITEM_FIELDS = ['name'] as const;

/**
 * Argument schema shared by `create_item` and `preview_item`: the full set of
 * item details either tool accepts, with only the name required.
 */
const ITEM_DETAILS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Product name.' },
    printingPricePerSheet: {
      type: 'number',
      description: 'Printing price per sheet, in the business currency unit. Optional.',
    },
    designingChargePerSheet: {
      type: 'number',
      description: 'One-off designing charge per sheet, in the business currency unit. Optional.',
    },
    configuration: {
      type: 'object',
      description:
        'Product-specific configuration, e.g. available paper sizes and finishes. Optional.',
      additionalProperties: true,
    },
  },
  required: [...REQUIRED_ITEM_FIELDS],
  additionalProperties: false,
};

/**
 * `create_item` — adds a printing product to the catalogue. Only the name is
 * required; the model is expected to collect that first and ask for anything
 * missing.
 */
export const createItemTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'create_item',
    description:
      'Create a new catalogue item. A name is required; the printing price per ' +
      'sheet, the designing charge per sheet and a free-form configuration bag ' +
      'are optional but worth asking for. If the user has not provided a name, ' +
      'ask them a follow-up question to collect it — do not call this tool with ' +
      'a placeholder, guessed or made-up value.',
    parameters: ITEM_DETAILS_SCHEMA,
  },
};

/**
 * Outcome of `create_item`. When `created` is false nothing was written and
 * `missingFields` names the required details to ask the user for.
 */
export type CreateItemToolResult =
  | { created: true; item: ItemResponse }
  | { created: false; missingFields: string[] };

/**
 * Executes `create_item` by delegating to ItemService. Required fields are
 * re-checked here so a premature call — the model skipping a follow-up — comes
 * back as a list of questions to ask instead of a thrown error.
 */
export async function runCreateItemTool(args: CreateItemRequest): Promise<CreateItemToolResult> {
  const missingFields = REQUIRED_ITEM_FIELDS.filter((field) => isBlank(args[field]));
  if (missingFields.length > 0) {
    return { created: false, missingFields: [...missingFields] };
  }

  const itemService = Container.get(ItemService);
  return { created: true, item: await itemService.createItem(args) };
}

/**
 * Outcome of `preview_item`. `ready: true` means every required detail is
 * present and the payload is safe to show the user for confirmation — nothing
 * has been saved. `ready: false` names the required details still to collect.
 */
export type PreviewItemToolResult =
  | { ready: true; requiresConfirmation: true; preview: CreateItemRequest }
  | { ready: false; missingFields: string[] };

/**
 * `preview_item` — collects the same details as `create_item` but only echoes
 * them back so the model can show a preview and ask for confirmation. It never
 * writes; the item is created by a later `create_item` call once the user
 * agrees.
 */
export const previewItemTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'preview_item',
    description:
      'Preview a new catalogue item before it is created. Accepts the same ' +
      'details as create_item and returns them so you can show the user and ask ' +
      'for confirmation; nothing is saved. Use this first and call create_item ' +
      'only once the user confirms. If the user has not provided a name, ask ' +
      'them a follow-up question to collect it — do not guess values.',
    parameters: ITEM_DETAILS_SCHEMA,
  },
};

/**
 * Executes `preview_item`: checks the required details are present and returns
 * the supplied values for confirmation. Has no side effects — no record is
 * written.
 */
export async function runPreviewItemTool(args: CreateItemRequest): Promise<PreviewItemToolResult> {
  const missingFields = REQUIRED_ITEM_FIELDS.filter((field) => isBlank(args[field]));
  if (missingFields.length > 0) {
    return { ready: false, missingFields: [...missingFields] };
  }

  return { ready: true, requiresConfirmation: true, preview: args };
}

/** True when a value is absent or only whitespace, so it counts as not supplied. */
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}
