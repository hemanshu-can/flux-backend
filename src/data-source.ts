import { DataSource } from 'typeorm';
import { Customer } from './models/customers';
import { Employee } from './models/employees';
import { Item } from './models/items';
import { Order } from './models/orders';
import { OutsourcingPartner } from './models/outsourcingPartners';
import { Quotation } from './models/quotations';

/**
 * Flux application data source (MongoDB via TypeORM).
 *
 * Connection settings come from the environment:
 * - DATABASE_URL: full mongodb/mongodb+srv connection string
 * - DATABASE_NAME: database to use inside the cluster (defaults to "flux")
 *
 * Register entities in the `entities` array as they are added.
 */
export const AppDataSource = new DataSource({
  type: 'mongodb',
  url: process.env.DATABASE_URL,
  database: process.env.DATABASE_NAME ?? 'flux',
  entities: [Customer, Employee, Item, Order, OutsourcingPartner, Quotation],
  synchronize: false,
});
