/**
 * Contracts for the quotation endpoints on QuotationController
 * (GET/POST/PATCH/DELETE under /api/v1/quotations).
 *
 * "splitup" holds the priced lines. The server derives every amount — each
 * line's amount, the tax amount and the grand total returned as "price" — so
 * clients never send them.
 */

/** One line of a quotation as supplied by a client. */
export interface QuotationLineInput {
  /** Item this line prices, when the line maps to a catalogue item. */
  itemId?: string;
  description: string;
  quantity: number;
  /** Price per unit, in the business currency unit. */
  unitPrice: number;
}

/** Tax header as supplied by a client; the amount is computed server-side. */
export interface QuotationTaxInput {
  /** Percentage, e.g. 18 for 18% GST. */
  rate: number;
}

/** Fields a client may set when creating or editing a quotation. */
export interface QuotationInput {
  customerId: string;
  splitup: QuotationLineInput[];
  /** Defaults to a 0% rate when omitted. */
  tax?: QuotationTaxInput;
  /** ISO-8601 date string, e.g. "2026-10-01". */
  validUntil?: string;
  notes?: string;
}

/** Body of POST /api/v1/quotations. */
export type CreateQuotationRequest = QuotationInput;

/** Body of PATCH /api/v1/quotations/:id — only provided fields are updated. */
export type UpdateQuotationRequest = Partial<QuotationInput>;

/** One computed line as returned by the API. */
export interface QuotationLineResponse {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** quantity * unitPrice, rounded to 2 decimals. */
  amount: number;
}

/** Computed tax as returned by the API. */
export interface QuotationTaxResponse {
  rate: number;
  amount: number;
}

/** A quotation as returned by the API. */
export interface QuotationResponse {
  id: string;
  customerId: string;
  splitup: QuotationLineResponse[];
  tax: QuotationTaxResponse;
  /** Grand total: sum(splitup.amount) + tax.amount. */
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
