import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

import type { OrderStatus } from '../types/order';

/**
 * A print order. Stored in the "orders" MongoDB collection.
 *
 * References are plain ObjectIds rather than TypeORM relations, so nothing is
 * joined implicitly — services resolve referenced documents explicitly. Mongo
 * has no foreign keys, so OrderService checks each reference exists on write.
 */
@Entity('orders')
export class Order {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  customerId!: ObjectId;

  /** Employee who owns the order, once one has been assigned. */
  @Column()
  employeeId?: ObjectId;

  @Column()
  itemId!: ObjectId;

  @Column()
  status!: OrderStatus;

  @Column()
  quantity!: number;

  /**
   * Paper stock, e.g. "matte 300gsm". Absent when the job was recorded before
   * its stock was decided — the field is optional, not stored blank.
   */
  @Column()
  paperType?: string;

  /**
   * Sheet size, e.g. "A4" or "12x18". Absent when the job was recorded before
   * its size was decided.
   */
  @Column()
  size?: string;

  @Column()
  delivered!: boolean;

  /** Quotation the order was priced from, when there is one. */
  @Column()
  quotationId?: ObjectId;

  /** Outsourcing partner the order was sent to, when there is one. */
  @Column()
  outsourcingPartnerId?: ObjectId;
}
