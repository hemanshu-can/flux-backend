/**
 * Contracts for the customer endpoints on CustomerController
 * (GET/POST/PATCH/DELETE under /api/v1/customers).
 */

/**
 * Postal address, stored inline as a nested document rather than a separate
 * collection, since it is only ever read with its customer.
 */
export interface DeliveryAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  /** 6-digit Indian postal code, kept as a string so leading zeros survive. */
  pincode: string;
}

/** Fields a client may set when creating or editing a customer. */
export interface CustomerInput {
  name: string;
  /** Primary contact phone number; normalized to bare digits. */
  contact: string;
  email?: string;
  /** Indian GSTIN, stored uppercase. */
  gstNumber?: string;
  companyName?: string;
  deliveryAddress?: DeliveryAddress;
}

/** Body of POST /api/v1/customers. */
export type CreateCustomerRequest = CustomerInput;

/** Body of PATCH /api/v1/customers/:id — only provided fields are updated. */
export type UpdateCustomerRequest = Partial<CustomerInput>;

/** A customer as returned by the API. */
export interface CustomerResponse {
  id: string;
  name: string;
  contact: string;
  email?: string;
  gstNumber?: string;
  companyName?: string;
  deliveryAddress?: DeliveryAddress;
}

/** Response of DELETE /api/v1/customers/:id. */
export interface DeleteCustomerResponse {
  deleted: true;
  id: string;
}
