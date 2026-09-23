import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

import type { DeliveryAddress } from '../types/customer';

/** A customer account. Stored in the "customers" MongoDB collection. */
@Entity('customers')
export class Customer {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  name!: string;

  /** Primary contact phone number, normalized to bare digits. */
  @Column()
  contact!: string;

  @Column()
  email?: string;

  /** Indian GSTIN, stored uppercase. */
  @Column()
  gstNumber?: string;

  @Column()
  companyName?: string;

  /** Delivery address, stored inline as a nested document. */
  @Column()
  deliveryAddress?: DeliveryAddress;
}
