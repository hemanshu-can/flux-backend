/**
 * Contracts for the outsourcing-partner endpoints on OutsourcingPartnerController
 * (GET/POST/PATCH/DELETE under /api/v1/outsourcing-partners).
 */

/** Fields a client may set when creating or editing an outsourcing partner. */
export interface OutsourcingPartnerInput {
  /** Partner company name. */
  name: string;
  /** Primary contact phone number; normalized to bare digits. */
  contact: string;
  email?: string;
  /** Indian GSTIN, stored uppercase. */
  gstNumber?: string;
  /** The kind of work outsourced to this partner, e.g. "binding". */
  serviceType?: string;
}

/** Body of POST /api/v1/outsourcing-partners. */
export type CreateOutsourcingPartnerRequest = OutsourcingPartnerInput;

/** Body of PATCH /api/v1/outsourcing-partners/:id — only provided fields are updated. */
export type UpdateOutsourcingPartnerRequest = Partial<OutsourcingPartnerInput>;

/** An outsourcing partner as returned by the API. */
export interface OutsourcingPartnerResponse {
  id: string;
  name: string;
  contact: string;
  email?: string;
  gstNumber?: string;
  serviceType?: string;
}

/** Response of DELETE /api/v1/outsourcing-partners/:id. */
export interface DeleteOutsourcingPartnerResponse {
  deleted: true;
  id: string;
}
