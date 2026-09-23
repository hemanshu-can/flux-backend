import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

/** One priced line of a quotation, as stored. */
export interface QuotationLine {
  /** Item this line prices, when the line maps to a catalogue item. */
  itemId?: ObjectId;
  description: string;
  quantity: number;
  unitPrice: number;
  /** quantity * unitPrice, rounded to 2 decimals. Derived by QuotationService. */
  amount: number;
}

/** Tax applied to a quotation, as stored. */
export interface QuotationTax {
  /** Percentage, e.g. 18 for 18% GST. */
  rate: number;
  /** Tax amount. Derived by QuotationService. */
  amount: number;
}

/**
 * A quotation sent to a customer. Stored in the "quotations" MongoDB collection.
 *
 * Line amounts, tax.amount and price are all derived by QuotationService and are
 * never accepted from the client.
 */
@Entity('quotations')
export class Quotation {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  customerId!: ObjectId;

  @Column()
  splitup!: QuotationLine[];

  @Column()
  tax!: QuotationTax;

  /** Grand total: sum(splitup.amount) + tax.amount. */
  @Column()
  price!: number;

  @Column()
  validUntil?: Date;

  @Column()
  notes?: string;
}
