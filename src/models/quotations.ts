import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

/**
 * The priced buckets a quotation is broken into, as stored.
 *
 * Every value is a currency amount. "tax" is the tax amount itself, not a rate.
 */
export interface QuotationSplitup {
  paper: number;
  designing: number;
  printing: number;
  binding: number;
  others: number;
  specialOthers: number;
  tax: number;
}

/**
 * A quotation sent to a customer. Stored in the "quotations" MongoDB collection.
 *
 * "price" is derived by QuotationService as the sum of every splitup value, so
 * it is never accepted from the client.
 */
@Entity('quotations')
export class Quotation {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  splitup!: QuotationSplitup;

  /** Grand total: the sum of every value in splitup, tax included. */
  @Column()
  price!: number;

  @Column()
  validUntil?: Date;

  @Column()
  notes?: string;
}
