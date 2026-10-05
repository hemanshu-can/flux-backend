import { Container } from 'typedi';

import { CustomerService } from '../services/CustomerService';
import type { ChatToolDefinition } from '../types/ai';
import type { CreateCustomerRequest, CustomerResponse } from '../types/customer';

/**
 * `search_customers` — lets the model resolve a customer by free text before
 * it needs an id (to raise a quotation, order, etc.). Matches partially and
 * case-insensitively against name, contact, email and company name.
 */
export const searchCustomersTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'search_customers',
    description:
      'Search customers by free text. Matches partially and case-insensitively ' +
      'against the customer name, contact number, email address and company ' +
      'name. Returns every matching customer; an empty array means no match.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full or partial name, contact number, email or company name to look up.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * Executes `search_customers` by delegating to CustomerService, which owns the
 * Mongo `$or` query. Call this with the parsed arguments object the model
 * returns on a tool call.
 */
export async function runSearchCustomersTool(args: { query: string }): Promise<CustomerResponse[]> {
  const customerService = Container.get(CustomerService);
  return customerService.searchCustomers(args.query);
}

/**
 * The required details `create_customer` cannot proceed without. If the user
 * has not supplied one of these, the model should ask a follow-up question
 * rather than inventing a value.
 */
const REQUIRED_CREATE_FIELDS = ['name', 'contact'] as const;

/**
 * Argument schema shared by `create_customer` and `preview_customer`: the full
 * set of customer details either tool accepts, with name and contact required.
 */
const CUSTOMER_DETAILS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Customer or contact-person name.' },
    contact: { type: 'string', description: 'Primary contact phone number, digits only.' },
    email: { type: 'string', description: 'Email address, if known.' },
    gstNumber: { type: 'string', description: 'Indian GSTIN, if the customer is registered.' },
    companyName: { type: 'string', description: 'Company name, if the customer is a business.' },
    deliveryAddress: {
      type: 'object',
      description: 'Postal delivery address, if known.',
      properties: {
        addressLine1: { type: 'string' },
        addressLine2: { type: 'string' },
        city: { type: 'string' },
        pincode: { type: 'string', description: '6-digit Indian postal code.' },
      },
      required: ['addressLine1', 'city', 'pincode'],
      additionalProperties: false,
    },
  },
  required: [...REQUIRED_CREATE_FIELDS],
  additionalProperties: false,
};

/**
 * `create_customer` — records a new customer account. Only name and contact are
 * required; the model is expected to collect those from the user first and ask
 * for anything missing.
 */
export const createCustomerTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'create_customer',
    description:
      'Create a new customer. A name and a contact phone number are required; ' +
      'email, GST number, company name and delivery address are optional but ' +
      'worth asking for. If the user has not provided the required details, ask ' +
      'them follow-up questions to collect the missing fields — do not call this ' +
      'tool with placeholder, guessed or made-up values.',
    parameters: CUSTOMER_DETAILS_SCHEMA,
  },
};

/**
 * Outcome of `create_customer`. When `created` is false nothing was written and
 * `missingFields` names the required details to ask the user for.
 */
export type CreateCustomerToolResult =
  | { created: true; customer: CustomerResponse }
  | { created: false; missingFields: string[] };

/**
 * Executes `create_customer` by delegating to CustomerService. Required fields
 * are re-checked here so a premature call — the model skipping a follow-up —
 * comes back as a list of questions to ask instead of a thrown error.
 */
export async function runCreateCustomerTool(
  args: CreateCustomerRequest,
): Promise<CreateCustomerToolResult> {
  const missingFields = REQUIRED_CREATE_FIELDS.filter((field) => isBlank(args[field]));
  if (missingFields.length > 0) {
    return { created: false, missingFields: [...missingFields] };
  }

  const customerService = Container.get(CustomerService);
  return { created: true, customer: await customerService.createCustomer(args) };
}

/**
 * Outcome of `preview_customer`. `ready: true` means every required detail is
 * present and the payload is safe to show the user for confirmation — nothing
 * has been saved. `ready: false` names the required details still to collect.
 */
export type PreviewCustomerToolResult =
  | { ready: true; requiresConfirmation: true; preview: CreateCustomerRequest }
  | { ready: false; missingFields: string[] };

/**
 * `preview_customer` — collects the same details as `create_customer` but only
 * echoes them back so the model can show a preview and ask for confirmation.
 * It never writes; the customer is created by a later `create_customer` call
 * once the user agrees.
 */
export const previewCustomerTool: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'preview_customer',
    description:
      'Preview a new customer before it is created. Accepts the same details as ' +
      'create_customer and returns them so you can show the user and ask for ' +
      'confirmation; nothing is saved. Use this first and call create_customer ' +
      'only once the user confirms. If the user has not provided the required ' +
      'name and contact number, ask them follow-up questions to collect the ' +
      'missing fields — do not guess values.',
    parameters: CUSTOMER_DETAILS_SCHEMA,
  },
};

/**
 * Executes `preview_customer`: checks the required details are present and
 * returns the supplied values for confirmation. Has no side effects — no
 * record is written.
 */
export async function runPreviewCustomerTool(
  args: CreateCustomerRequest,
): Promise<PreviewCustomerToolResult> {
  const missingFields = REQUIRED_CREATE_FIELDS.filter((field) => isBlank(args[field]));
  if (missingFields.length > 0) {
    return { ready: false, missingFields: [...missingFields] };
  }

  return { ready: true, requiresConfirmation: true, preview: args };
}

/** True when a value is absent or only whitespace, so it counts as not supplied. */
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}
