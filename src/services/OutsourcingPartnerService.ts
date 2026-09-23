import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { OutsourcingPartner } from '../models/outsourcingPartners';
import type {
  CreateOutsourcingPartnerRequest,
  DeleteOutsourcingPartnerResponse,
  OutsourcingPartnerResponse,
  UpdateOutsourcingPartnerRequest,
} from '../types/outsourcingPartner';
import {
  asRecord,
  rejectUnknownFields,
  requireEmail,
  requireGstNumber,
  requireMobile,
  requireString,
} from './validation';

const FIELD_NAMES = ['name', 'contact', 'email', 'gstNumber', 'serviceType'] as const;

/**
 * Outsourcing partner CRUD: list, read, create, patch and delete partner
 * companies in the "outsourcingPartners" collection. Validation and
 * normalization live here; the controller only handles HTTP concerns.
 */
@Service()
export class OutsourcingPartnerService {
  private get repo() {
    return AppDataSource.getRepository(OutsourcingPartner);
  }

  async listOutsourcingPartners(): Promise<OutsourcingPartnerResponse[]> {
    return (await this.repo.find()).map(toOutsourcingPartnerResponse);
  }

  async getOutsourcingPartner(id: string): Promise<OutsourcingPartnerResponse> {
    return toOutsourcingPartnerResponse(await this.findOutsourcingPartnerById(id));
  }

  async createOutsourcingPartner(
    input: CreateOutsourcingPartnerRequest,
  ): Promise<OutsourcingPartnerResponse> {
    const values = this.validateFields(input);

    if (values.name === undefined) {
      throw new BadRequestError('"name" is required.');
    }
    if (values.contact === undefined) {
      throw new BadRequestError('"contact" is required.');
    }

    const saved = await this.repo.save(this.repo.create(values) as OutsourcingPartner);
    return toOutsourcingPartnerResponse(saved);
  }

  async updateOutsourcingPartner(
    id: string,
    input: UpdateOutsourcingPartnerRequest,
  ): Promise<OutsourcingPartnerResponse> {
    const values = this.validateFields(input);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findOutsourcingPartnerById(id);

    Object.assign(current, values);
    return toOutsourcingPartnerResponse(await this.repo.save(current));
  }

  async deleteOutsourcingPartner(id: string): Promise<DeleteOutsourcingPartnerResponse> {
    const partner = await this.findOutsourcingPartnerById(id);
    await this.repo.delete({ _id: partner._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<OutsourcingPartner> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<OutsourcingPartner> = {};

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
    if ('serviceType' in record) {
      out.serviceType = requireString(record.serviceType, 'serviceType');
    }

    return out;
  }

  private async findOutsourcingPartnerById(id: string): Promise<OutsourcingPartner> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Outsourcing partner not found.');
    }
    const partner = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!partner) {
      throw new NotFoundError('Outsourcing partner not found.');
    }
    return partner;
  }
}

/** Maps a stored OutsourcingPartner to the JSON shape returned by the API. */
function toOutsourcingPartnerResponse(partner: OutsourcingPartner): OutsourcingPartnerResponse {
  return {
    id: partner._id.toHexString(),
    name: partner.name,
    contact: partner.contact,
    email: partner.email,
    gstNumber: partner.gstNumber,
    serviceType: partner.serviceType,
  };
}
