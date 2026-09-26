/**
 * Contracts for the quotation endpoints on QuotationController
 * (GET/POST/PATCH/DELETE under /api/v1/quotations).
 *
 * "splitup" holds the priced buckets — paper, designing, printing, binding,
 * others, specialOthers and tax — each a currency amount. The server derives
 * the grand total returned as "price" as their sum, so clients never send it.
 */

/**
 * The priced buckets a client supplies. Each is optional and defaults to zero,
 * so a quotation only states the buckets it actually uses.
 */
export interface QuotationSplitupInput {
  paper?: number;
  designing?: number;
  printing?: number;
  binding?: number;
  others?: number;
  specialOthers?: number;
  /** Tax amount, not a rate. */
  tax?: number;
}

/** Fields a client may set when creating or editing a quotation. */
export interface QuotationInput {
  splitup: QuotationSplitupInput;
  /** ISO-8601 date string, e.g. "2026-10-01". */
  validUntil?: string;
  notes?: string;
}

/**
 * Body of POST /api/v1/quotations.
 *
 * "orderId" tags the new quotation to an order: the order's quotationId is set
 * to the quotation, which is the link the orders list and detail view resolve
 * their price through.
 */
export interface CreateQuotationRequest extends QuotationInput {
  orderId?: string;
}

/** Body of PATCH /api/v1/quotations/:id — only provided fields are updated. */
export type UpdateQuotationRequest = Partial<QuotationInput>;

/** The buckets as returned by the API; every one is stored, so none is optional. */
export interface QuotationSplitupResponse {
  paper: number;
  designing: number;
  printing: number;
  binding: number;
  others: number;
  specialOthers: number;
  tax: number;
}

/** A quotation as returned by the API. */
export interface QuotationResponse {
  id: string;
  splitup: QuotationSplitupResponse;
  /** Grand total: the sum of every splitup value, tax included. */
  price: number;
  /** ISO-8601 date string. */
  validUntil?: string;
  notes?: string;
}

/** Response of DELETE /api/v1/quotations/:id. */
export interface DeleteQuotationResponse {
  deleted: true;
  id: string;
}
