/**
 * Contracts for the item endpoints on ItemController
 * (GET/POST/PATCH/DELETE under /api/v1/items).
 */

/**
 * Product-specific configuration bag, e.g.
 * { paperSizes: ["A4", "A5"], finishes: ["matte", "gloss"] }.
 */
export type ItemConfiguration = Record<string, unknown>;

/** Fields a client may set when creating or editing an item. */
export interface ItemInput {
  name: string;
  /** Printing price per sheet, in the business currency unit. */
  printingPricePerSheet: number;
  /** One-off designing charge per sheet, in the business currency unit. */
  designingChargePerSheet: number;
  configuration?: ItemConfiguration;
}

/** Body of POST /api/v1/items. */
export type CreateItemRequest = ItemInput;

/** Body of PATCH /api/v1/items/:id — only provided fields are updated. */
export type UpdateItemRequest = Partial<ItemInput>;

/** An item as returned by the API. */
export interface ItemResponse {
  id: string;
  name: string;
  printingPricePerSheet: number;
  designingChargePerSheet: number;
  configuration?: ItemConfiguration;
}

/** Response of DELETE /api/v1/items/:id. */
export interface DeleteItemResponse {
  deleted: true;
  id: string;
}
