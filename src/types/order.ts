/**
 * Contracts for the order endpoints on OrderController
 * (GET/POST/PATCH/DELETE under /api/v1/orders).
 *
 * ORDER_STATUS is both the runtime list and the source of the OrderStatus
 * union, so validation and typing cannot drift apart.
 */

/**
 * Lifecycle states an order moves through, in the order they occur. An order
 * starts at "just_in" and ends at "finished".
 */
export const ORDER_STATUS = [
  'just_in',
  'designing',
  'in_production',
  'ready',
  'payment_pending',
  'finished',
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];

/** Fields a client may set when creating or editing an order. */
export interface OrderInput {
  customerId: string;
  employeeId: string;
  itemId: string;
  /** Defaults to "just_in" when omitted. */
  status?: OrderStatus;
  quantity: number;
  /** Paper stock, e.g. "matte 300gsm". Free-form. */
  paperType: string;
  /** Sheet size, e.g. "A4" or "12x18". Free-form. */
  size: string;
  /** Defaults to false when omitted. */
  delivered?: boolean;
  /** Set once the order is priced off a quotation. */
  quotationId?: string;
  /** Set when the order has been sent to an outsourcing partner. */
  outsourcingPartnerId?: string;
}

/** Body of POST /api/v1/orders. */
export type CreateOrderRequest = OrderInput;

/** Body of PATCH /api/v1/orders/:id — only provided fields are updated. */
export type UpdateOrderRequest = Partial<OrderInput>;

/** An order as returned by the API. */
export interface OrderResponse {
  id: string;
  customerId: string;
  employeeId: string;
  itemId: string;
  status: OrderStatus;
  quantity: number;
  paperType: string;
  size: string;
  delivered: boolean;
  quotationId?: string;
  outsourcingPartnerId?: string;
}

/** Response of DELETE /api/v1/orders/:id. */
export interface DeleteOrderResponse {
  deleted: true;
  id: string;
}
