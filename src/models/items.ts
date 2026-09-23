import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

import type { ItemConfiguration } from '../types/item';

/**
 * A printing product. Stored in the "items" MongoDB collection.
 *
 * Prices are plain numbers in the business currency unit; minor-unit (paise)
 * handling is not modelled yet.
 */
@Entity('items')
export class Item {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  name!: string;

  /** Printing price per sheet. */
  @Column()
  printingPricePerSheet!: number;

  /** One-off designing charge per sheet. */
  @Column()
  designingChargePerSheet!: number;

  /** Product-specific configuration, e.g. available sizes and finishes. */
  @Column()
  configuration?: ItemConfiguration;
}
