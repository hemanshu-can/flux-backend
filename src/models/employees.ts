import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

import type { EmployeeType } from '../types/employee';

/** A staff member. Stored in the "employees" MongoDB collection. */
@Entity('employees')
export class Employee {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  firstName!: string;

  @Column()
  lastName?: string;

  /** Unique across employees; stored lowercase. */
  @Column()
  email!: string;

  @Column()
  employeeType!: EmployeeType;
}
