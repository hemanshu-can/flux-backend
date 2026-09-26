import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Customer } from '../models/customers';
import { Employee } from '../models/employees';
import { Item } from '../models/items';
import { Order } from '../models/orders';
import { OutsourcingPartner } from '../models/outsourcingPartners';
import { Quotation } from '../models/quotations';
import { ORDER_STATUS } from '../types/order';
import type {
  CreateOrderRequest,
  DeleteOrderResponse,
  OrderResponse,
  UpdateOrderRequest,
} from '../types/order';
import {
  asRecord,
  assertReferenceExists,
  rejectUnknownFields,
  requireBoolean,
  requireEnum,
  requireObjectId,
  requirePositiveInteger,
  optionalString,
} from './validation';

/** Every field a client may set on an order, in the order they are validated. */
const ORDER_FIELDS = [
  'customerId',
  'employeeId',
  'itemId',
  'status',
  'quantity',
  'paperType',
  'size',
  'delivered',
  'quotationId',
  'outsourcingPartnerId',
] as const;

type OrderField = (typeof ORDER_FIELDS)[number];

/** Fields of POST /api/v1/orders: the batch's shared parties, plus its lines. */
const BATCH_FIELDS = ['customerId', 'employeeId', 'items'] as const;

/**
 * Batch fields that must be present. The employee is not among them: an order
 * can be recorded before anyone has been assigned to it.
 */
const REQUIRED_BATCH_FIELDS = ['customerId', 'items'] as const;

/**
 * Fields of one line in a create batch. Everything an order needs except the
 * customer and the employee, which the batch supplies once for every line.
 */
const LINE_FIELDS: readonly OrderField[] = [
  'itemId',
  'status',
  'quantity',
  'paperType',
  'size',
  'delivered',
  'quotationId',
  'outsourcingPartnerId',
];

/** Validator per field; `field` is the client-facing name, including any prefix. */
const VALIDATORS: Record<OrderField, (value: unknown, field: string) => unknown> = {
  customerId: requireObjectId,
  employeeId: requireObjectId,
  itemId: requireObjectId,
  status: (value, field) => requireEnum(value, ORDER_STATUS, field),
  quantity: requirePositiveInteger,
  paperType: optionalString,
  size: optionalString,
  delivered: requireBoolean,
  quotationId: requireObjectId,
  outsourcingPartnerId: requireObjectId,
};

/** Reference fields, re-checked whenever a patch changes them. */
const REFERENCE_FIELDS = [
  'customerId',
  'employeeId',
  'itemId',
  'quotationId',
  'outsourcingPartnerId',
] as const;

/**
 * Order CRUD: list, read, create, patch and delete jobs in the "orders"
 * collection. Validation and normalization live here; the controller only
 * handles HTTP concerns.
 *
 * Creating is batched: one request turns a customer's job into one stored
 * order per item line it contains.
 */
@Service()
export class OrderService {
  private get repo() {
    return AppDataSource.getRepository(Order);
  }

  async listOrders(): Promise<OrderResponse[]> {
    return (await this.repo.find()).map(toOrderResponse);
  }

  async getOrder(id: string): Promise<OrderResponse> {
    return toOrderResponse(await this.findOrderById(id));
  }

  /**
   * Creates one order per entry in `input.items`, all for the request's
   * customer and employee. A single order is a batch of one line.
   */
  async createOrders(input: CreateOrderRequest): Promise<OrderResponse[]> {
    const body = asRecord(input);
    rejectUnknownFields(body, BATCH_FIELDS);

    for (const field of REQUIRED_BATCH_FIELDS) {
      if (body[field] === undefined) {
        throw new BadRequestError(`"${field}" is required.`);
      }
    }

    const customerId = requireObjectId(body.customerId, 'customerId');
    const employeeId =
      body.employeeId === undefined
        ? undefined
        : requireObjectId(body.employeeId, 'employeeId');

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestError('"items" must be a non-empty array of item lines.');
    }

    // Every line is validated before anything is written, so a bad line at the
    // end of a batch cannot leave the lines before it stored and the rest not.
    const lines = body.items.map((line, index) => {
      const label = `items[${index}]`;
      const values = this.validateFields(line, LINE_FIELDS, label);
      if (values.itemId === undefined) {
        throw new BadRequestError(`"${label}.itemId" is required.`);
      }
      return { ...values, itemId: values.itemId };
    });

    await this.assertReferencesExist({ customerId, employeeId }, ...lines);

    // What every order in the batch shares. The employee is left off entirely
    // when none was given, rather than stored as a blank id.
    const shared: Partial<Order> = { customerId };
    if (employeeId !== undefined) {
      shared.employeeId = employeeId;
    }

    const orders = this.repo.create(
      lines.map((line) => ({
        ...shared,
        ...line,
        status: line.status ?? 'just_in',
        delivered: line.delivered ?? false,
      })) as Order[],
    );

    return (await this.repo.save(orders)).map(toOrderResponse);
  }

  async updateOrder(id: string, input: UpdateOrderRequest): Promise<OrderResponse> {
    const values = this.validateFields(input, ORDER_FIELDS);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findOrderById(id);

    // Only re-check references this patch actually changes.
    const changedReferences: Partial<Order> = {};
    for (const field of REFERENCE_FIELDS) {
      const next = values[field];
      if (next === undefined) {
        continue;
      }
      const previous = current[field];
      if (previous === undefined || !next.equals(previous)) {
        changedReferences[field] = next;
      }
    }
    await this.assertReferencesExist(changedReferences);

    Object.assign(current, values);
    return toOrderResponse(await this.repo.save(current));
  }

  async deleteOrder(id: string): Promise<DeleteOrderResponse> {
    const order = await this.findOrderById(id);
    await this.repo.delete({ _id: order._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /**
   * Validates the fields a client may set and returns the normalized ones.
   * `label` names the record the fields came from when it is one of many — a
   * create batch's lines — so errors point at the line that failed.
   */
  private validateFields(
    input: unknown,
    allowed: readonly OrderField[],
    label?: string,
  ): Partial<Order> {
    const record = asRecord(input, label ? `"${label}"` : undefined);
    rejectUnknownFields(record, allowed, label);

    const out: Partial<Order> = {};

    for (const field of allowed) {
      if (field in record) {
        const name = label ? `${label}.${field}` : field;
        // The table pairs each key with a validator returning that field's type.
        const value = VALIDATORS[field](record[field], name);
        // A validator returning undefined means "not provided" — a blank
        // paper stock or size, say — so the field is left out of the document
        // rather than stored blank. The employee's optional surname sets the
        // same precedent.
        if (value === undefined) {
          continue;
        }
        (out as Record<string, unknown>)[field] = value;
      }
    }

    return out;
  }

  /**
   * Rejects references to documents that do not exist. MongoDB has no foreign
   * keys, so without this an order can point at a customer that was never
   * created, or that has since been deleted. An id is checked once per field,
   * so a batch that reuses one item across lines does not repeat the lookup.
   */
  private async assertReferencesExist(...values: Partial<Order>[]): Promise<void> {
    const checked = new Set<string>();

    for (const value of values) {
      for (const field of REFERENCE_FIELDS) {
        const id = value[field];
        if (id === undefined) {
          continue;
        }
        const key = `${field}:${id.toHexString()}`;
        if (checked.has(key)) {
          continue;
        }
        checked.add(key);
        await this.assertReferenceFor(field, id);
      }
    }
  }

  private async assertReferenceFor(
    field: (typeof REFERENCE_FIELDS)[number],
    id: ObjectId,
  ): Promise<void> {
    switch (field) {
      case 'customerId':
        return assertReferenceExists(Customer, id, field, 'customer');
      case 'employeeId':
        return assertReferenceExists(Employee, id, field, 'employee');
      case 'itemId':
        return assertReferenceExists(Item, id, field, 'item');
      case 'quotationId':
        return assertReferenceExists(Quotation, id, field, 'quotation');
      case 'outsourcingPartnerId':
        return assertReferenceExists(OutsourcingPartner, id, field, 'outsourcing partner');
    }
  }

  private async findOrderById(id: string): Promise<Order> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Order not found.');
    }
    const order = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!order) {
      throw new NotFoundError('Order not found.');
    }
    return order;
  }
}

/** Maps a stored Order to the JSON shape returned by the API. */
function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order._id.toHexString(),
    customerId: order.customerId.toHexString(),
    employeeId: order.employeeId?.toHexString(),
    itemId: order.itemId.toHexString(),
    status: order.status,
    quantity: order.quantity,
    paperType: order.paperType,
    size: order.size,
    delivered: order.delivered,
    quotationId: order.quotationId?.toHexString(),
    outsourcingPartnerId: order.outsourcingPartnerId?.toHexString(),
  };
}
