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
  requireString,
} from './validation';

const FIELD_NAMES = [
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

  async createOrder(input: CreateOrderRequest): Promise<OrderResponse> {
    const values = this.validateFields(input);

    for (const field of ['customerId', 'employeeId', 'itemId'] as const) {
      if (values[field] === undefined) {
        throw new BadRequestError(`"${field}" is required.`);
      }
    }

    await this.assertReferencesExist(values);

    const order = this.repo.create({
      ...values,
      status: values.status ?? 'just_in',
      delivered: values.delivered ?? false,
    } as Order);

    return toOrderResponse(await this.repo.save(order));
  }

  async updateOrder(id: string, input: UpdateOrderRequest): Promise<OrderResponse> {
    const values = this.validateFields(input);
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

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<Order> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<Order> = {};

    if ('customerId' in record) {
      out.customerId = requireObjectId(record.customerId, 'customerId');
    }
    if ('employeeId' in record) {
      out.employeeId = requireObjectId(record.employeeId, 'employeeId');
    }
    if ('itemId' in record) {
      out.itemId = requireObjectId(record.itemId, 'itemId');
    }
    if ('status' in record) {
      out.status = requireEnum(record.status, ORDER_STATUS, 'status');
    }
    if ('quantity' in record) {
      out.quantity = requirePositiveInteger(record.quantity, 'quantity');
    }
    if ('paperType' in record) {
      out.paperType = requireString(record.paperType, 'paperType');
    }
    if ('size' in record) {
      out.size = requireString(record.size, 'size');
    }
    if ('delivered' in record) {
      out.delivered = requireBoolean(record.delivered, 'delivered');
    }
    if ('quotationId' in record) {
      out.quotationId = requireObjectId(record.quotationId, 'quotationId');
    }
    if ('outsourcingPartnerId' in record) {
      out.outsourcingPartnerId = requireObjectId(
        record.outsourcingPartnerId,
        'outsourcingPartnerId',
      );
    }

    return out;
  }

  /**
   * Rejects references to documents that do not exist. MongoDB has no foreign
   * keys, so without this an order can point at a customer that was never
   * created, or that has since been deleted.
   */
  private async assertReferencesExist(values: Partial<Order>): Promise<void> {
    await assertReferenceExists(Customer, values.customerId, 'customerId', 'customer');
    await assertReferenceExists(Employee, values.employeeId, 'employeeId', 'employee');
    await assertReferenceExists(Item, values.itemId, 'itemId', 'item');
    await assertReferenceExists(Quotation, values.quotationId, 'quotationId', 'quotation');
    await assertReferenceExists(
      OutsourcingPartner,
      values.outsourcingPartnerId,
      'outsourcingPartnerId',
      'outsourcing partner',
    );
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
    employeeId: order.employeeId.toHexString(),
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
