import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

/**
 * An external company the business outsources work to. Stored in the
 * "outsourcingPartners" MongoDB collection.
 */
@Entity('outsourcingPartners')
export class OutsourcingPartner {
  @ObjectIdColumn()
  _id!: ObjectId;

  /** Partner company name. */
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

  /** The kind of work outsourced to this partner, e.g. "binding". */
  @Column()
  serviceType?: string;
}
