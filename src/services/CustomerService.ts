import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Customer } from '../models/customers';
import type {
  CreateCustomerRequest,
  CustomerResponse,
  DeleteCustomerResponse,
  DeliveryAddress,
  UpdateCustomerRequest,
} from '../types/customer';
import {
  asRecord,
  rejectUnknownFields,
  requireEmail,
  requireGstNumber,
  requireMobile,
  requirePincode,
  requireString,
} from './validation';

const FIELD_NAMES = [
  'name',
  'contact',
  'email',
  'gstNumber',
  'companyName',
  'deliveryAddress',
] as const;

const ADDRESS_FIELDS = ['addressLine1', 'addressLine2', 'city', 'pincode'] as const;

/**
 * Customer CRUD: list, read, create, patch and delete accounts in the
 * "customers" collection. Validation and normalization live here; the
 * controller only handles HTTP concerns.
 */
@Service()
export class CustomerService {
  private get repo() {
    return AppDataSource.getRepository(Customer);
  }

  async listCustomers(): Promise<CustomerResponse[]> {
    return (await this.repo.find()).map(toCustomerResponse);
  }

  async getCustomer(id: string): Promise<CustomerResponse> {
    return toCustomerResponse(await this.findCustomerById(id));
  }

  async createCustomer(input: CreateCustomerRequest): Promise<CustomerResponse> {
    const values = this.validateFields(input);

    if (values.name === undefined) {
      throw new BadRequestError('"name" is required.');
    }
    if (values.contact === undefined) {
      throw new BadRequestError('"contact" is required.');
    }

    const saved = await this.repo.save(this.repo.create(values) as Customer);
    return toCustomerResponse(saved);
  }

  async updateCustomer(id: string, input: UpdateCustomerRequest): Promise<CustomerResponse> {
    const values = this.validateFields(input);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findCustomerById(id);

    Object.assign(current, values);
    return toCustomerResponse(await this.repo.save(current));
  }

  async deleteCustomer(id: string): Promise<DeleteCustomerResponse> {
    const customer = await this.findCustomerById(id);
    await this.repo.delete({ _id: customer._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<Customer> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<Customer> = {};

    if ('name' in record) {
      out.name = requireString(record.name, 'name');
    }
    if ('contact' in record) {
      out.contact = requireMobile(record.contact, 'contact');
    }
    if ('email' in record) {
      out.email = requireEmail(record.email);
    }
    if ('gstNumber' in record) {
      out.gstNumber = requireGstNumber(record.gstNumber, 'gstNumber');
    }
    if ('companyName' in record) {
      out.companyName = requireString(record.companyName, 'companyName');
    }
    if ('deliveryAddress' in record) {
      out.deliveryAddress = toValidatedAddress(record.deliveryAddress);
    }

    return out;
  }

  private async findCustomerById(id: string): Promise<Customer> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Customer not found.');
    }
    const customer = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!customer) {
      throw new NotFoundError('Customer not found.');
    }
    return customer;
  }
}

/**
 * Validates the nested delivery address. It is stored inline, so a patch
 * replaces the whole address rather than merging into it.
 */
function toValidatedAddress(value: unknown): DeliveryAddress {
  const record = asRecord(value, '"deliveryAddress"');
  rejectUnknownFields(record, ADDRESS_FIELDS);

  const address: DeliveryAddress = {
    addressLine1: requireString(record.addressLine1, 'deliveryAddress.addressLine1'),
    city: requireString(record.city, 'deliveryAddress.city'),
    pincode: requirePincode(record.pincode, 'deliveryAddress.pincode'),
  };

  if (record.addressLine2 !== undefined) {
    address.addressLine2 = requireString(record.addressLine2, 'deliveryAddress.addressLine2');
  }

  return address;
}

/** Maps a stored Customer to the JSON shape returned by the API. */
function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer._id.toHexString(),
    name: customer.name,
    contact: customer.contact,
    email: customer.email,
    gstNumber: customer.gstNumber,
    companyName: customer.companyName,
    deliveryAddress: customer.deliveryAddress,
  };
}
