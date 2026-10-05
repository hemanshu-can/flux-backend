import { Container } from 'typedi';

import { OrderService } from '../services/OrderService';
import type { ChatToolDefinition } from '../types/ai';
import { ORDER_STATUS } from '../types/order';
import type { CreateOrderRequest, OrderResponse } from '../types/order';

/**
 * Argument schema shared by `create_order` and `preview_order` — the body of
 * POST /api/v1/orders. A batch names one customer and carries one line per
 * order to create; each line needs an item and a quantity.
 *
 * The customer and the items are referenced by id, so the model is expected to
 * resolve names with search_customers / search_items first.
 */
const ORDER_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    customerId: {
      type: 'string',
      description: 'Id of the customer the orders are for, as returned by search_customers.',
    },
    employeeId: {
      type: 'string',
      description:
        'Id of the employee the orders are assigned to. Optional — an order can be ' +
        'recorded before anyone is assigned.',
    },
    items: {
      type: 'array',
      minItems: 1,
      description: 'One entry per order to create, all for the same customer.',
      items: {
        type: 'object',
        properties: {
          itemId: {
            type: 'string',
            description: 'Id of the catalogue item, as returned by search_items.',
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            description: 'How many of the item the order covers.',
          },
          status: {
            type: 'string',
            enum: [...ORDER_STATUS],
            description: 'Lifecycle status. Defaults to "just_in".',
          },
          paperType: {
            type: 'string',
            description: 'Paper stock, e.g. "matte 300gsm". Optional.',
          },
          size: {
            type: 'string',
            description: 'Sheet size, e.g. "A4" or "12x18". Optional.',
          },
          delivered: {
            type: 'boolean',
            description: 'Whether the order is delivered. Defaults to false.',
          },
          quotationId: {
            type: 'string',
            description: 'Id of the quotation the order is priced from. Optional.',
          },
          outsourcingPartnerId: {
            type: 'string',
            description: 'Id of the outsourcing partner the order was sent to. Optional.',
          },
        },
        required: ['itemId', 'quantity'],
        additionalProperties: false,
      },
    },
  },
  required: ['customerId', 'items'],
  additionalProperties: false,
};

/**
 * `create_order` — records the jobs a batch describes, one stored order per
 * item line. The customer and items must already be resolved to ids; the model
 * gathers anything missing from the user first.
 */
export const createOrderTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'create_order',
    description:
      'Create one or more orders. Every order needs a customer and at least one ' +
      'item line, and each line needs an item and a quantity — one order is ' +
      'created per line. The customer and the items must be referenced by the ids ' +
      'returned by search_customers and search_items: if the user gave names, look ' +
      'them up first, and if a search returns no match or several matches, ask the ' +
      'user before continuing. If any required detail is missing, the result lists ' +
      'it — ask the user for it rather than guessing. Prefer preview_order to show ' +
      'the details and get confirmation before calling this.',
    parameters: ORDER_SCHEMA,
  },
};

/**
 * Outcome of `create_order`. When `created` is false nothing was written and
 * `missingFields` names the required details to ask the user for, as field
 * paths such as "customerId" or "items[0].quantity".
 */
export type CreateOrderToolResult =
  | { created: true; orders: OrderResponse[] }
  | { created: false; missingFields: string[] };

/**
 * Executes `create_order` by delegating to OrderService, which owns batch
 * validation and the reference checks. Required details are re-checked here so
 * a premature call — the model skipping a follow-up — comes back as a list of
 * questions to ask instead of a thrown error.
 */
export async function runCreateOrderTool(
  args: CreateOrderRequest,
): Promise<CreateOrderToolResult> {
  const missingFields = collectMissingOrderFields(args);
  if (missingFields.length > 0) {
    return { created: false, missingFields };
  }

  const orderService = Container.get(OrderService);
  return { created: true, orders: await orderService.createOrders(args) };
}

/**
 * `preview_order` — collects the same details as `create_order` but only
 * echoes them back so the model can show a preview and ask for confirmation.
 * It never writes; the orders are created by a later `create_order` call once
 * the user agrees.
 */
export const previewOrderTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'preview_order',
    description:
      'Preview the orders that would be created, so the user can confirm before ' +
      'anything is saved. Takes the same details as create_order: a customer and ' +
      'at least one item line, each with an item and a quantity. The customer and ' +
      'the items must be ids from search_customers and search_items — look names ' +
      'up first, and ask the user when a search returns no match or several. ' +
      'Nothing is written; call create_order once the user confirms. If any ' +
      'required detail is missing, the result lists it — ask the user for it ' +
      'rather than guessing.',
    parameters: ORDER_SCHEMA,
  },
};

/**
 * Outcome of `preview_order`. `ready: true` means every required detail is
 * present and the payload is safe to show the user for confirmation — nothing
 * has been saved. `ready: false` names the required details still to collect.
 */
export type PreviewOrderToolResult =
  | { ready: true; requiresConfirmation: true; preview: CreateOrderRequest }
  | { ready: false; missingFields: string[] };

/**
 * Executes `preview_order`: checks the required details are present and returns
 * the supplied values for confirmation. Has no side effects — no record is
 * written.
 */
export async function runPreviewOrderTool(
  args: CreateOrderRequest,
): Promise<PreviewOrderToolResult> {
  const missingFields = collectMissingOrderFields(args);
  if (missingFields.length > 0) {
    return { ready: false, missingFields };
  }

  return { ready: true, requiresConfirmation: true, preview: args };
}

/**
 * Names every required detail that is absent or unusable, as a field path
 * (e.g. "customerId", "items[0].quantity"). An empty result means the batch is
 * ready to create; a non-empty one becomes a question for the user.
 */
function collectMissingOrderFields(args: CreateOrderRequest): string[] {
  const missing: string[] = [];

  if (isBlank(args.customerId)) {
    missing.push('customerId');
  }

  // Without at least one line there is no order to create, and no lines to
  // inspect for per-line details.
  if (!Array.isArray(args.items) || args.items.length === 0) {
    missing.push('items');
    return missing;
  }

  args.items.forEach((line, index) => {
    if (isBlank(line.itemId)) {
      missing.push(`items[${index}].itemId`);
    }
    if (!isPositiveInteger(line.quantity)) {
      missing.push(`items[${index}].quantity`);
    }
  });

  return missing;
}

/** True when a value is absent or only whitespace, so it counts as not supplied. */
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

/** A quantity is usable only as a whole number of at least one. */
function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}
