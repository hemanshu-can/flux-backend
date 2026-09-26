/**
 * Contracts for the order endpoints on OrderController
 * (GET/POST/PATCH/DELETE under /api/v1/orders).
 *
 * ORDER_STATUS is both the runtime list and the source of the OrderStatus
 * union, so validation and typing cannot drift apart.
 *
 * An order is one customer, one item and one quantity. Posting a job that
 * covers several items therefore posts several orders: CreateOrderRequest
 * hoists the customer and the employee that the whole batch shares and carries
 * one OrderLineInput per order to create.
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
  /**
   * Absent when the order has not been assigned to anyone yet. An order can be
   * created without one, but a patch cannot clear it — there is no way to
   * express "unassign" other than omitting the field.
   */
  employeeId?: string;
  itemId: string;
  /** Defaults to "just_in" when omitted. */
  status?: OrderStatus;
  quantity: number;
  /**
   * Paper stock, e.g. "matte 300gsm". Free-form, and optional: a job can be
   * recorded before its stock is decided, and a blank value is dropped rather
   * than stored. A patch can replace it but not clear it, like the employee
   * and the outsourcing partner.
   */
  paperType?: string;
  /**
   * Sheet size, e.g. "A4" or "12x18". Free-form, and optional on the same
   * terms as the paper stock.
   */
  size?: string;
  /** Defaults to false when omitted. */
  delivered?: boolean;
  /** Set once the order is priced off a quotation. */
  quotationId?: string;
  /** Set when the order has been sent to an outsourcing partner. */
  outsourcingPartnerId?: string;
}

/**
 * One line of a batch create: everything an order needs except the customer
 * and the employee, which the batch supplies once for all of its lines.
 */
export type OrderLineInput = Omit<OrderInput, 'customerId' | 'employeeId'>;

/**
 * Body of POST /api/v1/orders. Creates one order per entry in `items`, all for
 * the same customer. At least one line is required; a single order is a batch
 * of one. `employeeId` is the one shared field that may be left out, so a job
 * can be recorded before anyone is assigned to it.
 */
export interface CreateOrderRequest {
  customerId: string;
  employeeId?: string;
  items: OrderLineInput[];
}

/** Body of PATCH /api/v1/orders/:id — only provided fields are updated. */
export type UpdateOrderRequest = Partial<OrderInput>;

/** An order as returned by the API. */
export interface OrderResponse {
  id: string;
  customerId: string;
  /** Absent when no employee has been assigned to the order. */
  employeeId?: string;
  itemId: string;
  status: OrderStatus;
  quantity: number;
  /** Absent when the order was recorded without a stock. */
  paperType?: string;
  /** Absent when the order was recorded without a size. */
  size?: string;
  delivered: boolean;
  quotationId?: string;
  outsourcingPartnerId?: string;
}

/** Response of POST /api/v1/orders — the orders that were created, in order. */
export type CreateOrdersResponse = OrderResponse[];

/** Response of DELETE /api/v1/orders/:id. */
export interface DeleteOrderResponse {
  deleted: true;
  id: string;
}
