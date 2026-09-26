import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Order } from '../models/orders';
import { Quotation } from '../models/quotations';
import type { QuotationSplitup } from '../models/quotations';
import type {
  CreateQuotationRequest,
  DeleteQuotationResponse,
  QuotationResponse,
  UpdateQuotationRequest,
} from '../types/quotation';
import {
  asRecord,
  rejectUnknownFields,
  requireDate,
  requireNumber,
  requireObjectId,
  requireString,
} from './validation';

const FIELD_NAMES = ['splitup', 'validUntil', 'notes'] as const;

/** POST additionally takes the order the new quotation is tagged to. */
const CREATE_FIELD_NAMES: readonly string[] = [...FIELD_NAMES, 'orderId'];

/** The buckets a quotation is priced in. Every one is a currency amount. */
const SPLITUP_FIELDS = [
  'paper',
  'designing',
  'printing',
  'binding',
  'others',
  'specialOthers',
  'tax',
] as const;

type SplitupField = (typeof SPLITUP_FIELDS)[number];

/**
 * The normalized fields a validated request contributes, before buckets are
 * defaulted. "splitup" holds only the buckets the client actually supplied.
 */
interface ValidatedFields {
  splitup?: Partial<QuotationSplitup>;
  validUntil?: Date;
  notes?: string;
  /** Present on create only: the order the quotation is tagged to. */
  orderId?: ObjectId;
}

/** Every bucket at zero, so a stored quotation always carries the full set. */
const ZERO_SPLITUP: QuotationSplitup = {
  paper: 0,
  designing: 0,
  printing: 0,
  binding: 0,
  others: 0,
  specialOthers: 0,
  tax: 0,
};

/**
 * Quotation CRUD: list, read, create, patch and delete quotes in the
 * "quotations" collection.
 *
 * Clients supply the priced buckets; every figure derived from them — the grand
 * total stored as "price" — is computed here so it can never disagree with the
 * buckets it is made of.
 */
@Service()
export class QuotationService {
  private get repo() {
    return AppDataSource.getRepository(Quotation);
  }

  async listQuotations(): Promise<QuotationResponse[]> {
    return (await this.repo.find()).map(toQuotationResponse);
  }

  async getQuotation(id: string): Promise<QuotationResponse> {
    return toQuotationResponse(await this.findQuotationById(id));
  }

  async createQuotation(input: CreateQuotationRequest): Promise<QuotationResponse> {
    const values = this.validateFields(input, CREATE_FIELD_NAMES);

    if (values.splitup === undefined) {
      throw new BadRequestError('"splitup" is required.');
    }

    const { orderId, splitup, ...rest } = values;

    // The order is resolved before anything is written, so a bad orderId fails
    // without leaving a quotation behind.
    const orders = AppDataSource.getRepository(Order);
    const order = orderId === undefined ? null : await orders.findOne({ where: { _id: orderId } });
    if (orderId !== undefined && !order) {
      throw new BadRequestError('"orderId" points at an order that does not exist.');
    }

    // Buckets left out are stored as zero, so the document always holds all of
    // them and the total is a sum of the same set every time.
    const quotation = this.repo.create({
      ...rest,
      splitup: { ...ZERO_SPLITUP, ...splitup },
    } as Quotation);

    applyTotals(quotation);
    const saved = await this.repo.save(quotation);

    // Tagging writes the link onto the order rather than the quotation:
    // Order.quotationId is what the orders list resolves a price through.
    // Tagging a second quotation to the same order re-points it, leaving the
    // first quotation stored but unreferenced.
    if (order) {
      order.quotationId = saved._id;
      await orders.save(order);
    }

    return toQuotationResponse(saved);
  }

  async updateQuotation(id: string, input: UpdateQuotationRequest): Promise<QuotationResponse> {
    const values = this.validateFields(input, FIELD_NAMES);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findQuotationById(id);

    const { splitup, ...rest } = values;
    Object.assign(current, rest);
    // Buckets are merged rather than replaced, so a patch can move one figure
    // without restating the rest. The total is then recomputed from the whole
    // merged set.
    if (splitup !== undefined) {
      current.splitup = { ...current.splitup, ...splitup };
    }

    applyTotals(current);
    return toQuotationResponse(await this.repo.save(current));
  }

  async deleteQuotation(id: string): Promise<DeleteQuotationResponse> {
    const quotation = await this.findQuotationById(id);
    await this.repo.delete({ _id: quotation._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /**
   * Validates a request body and returns the normalized mutable fields.
   * `allowed` differs between create and patch: only create takes an orderId.
   */
  private validateFields(input: unknown, allowed: readonly string[]): ValidatedFields {
    const record = asRecord(input);
    rejectUnknownFields(record, allowed);

    const out: ValidatedFields = {};

    if ('splitup' in record) {
      const splitup = toValidatedSplitup(record.splitup);
      if (Object.keys(splitup).length === 0) {
        throw new BadRequestError('"splitup" must contain at least one bucket.');
      }
      out.splitup = splitup;
    }
    if ('validUntil' in record) {
      out.validUntil = requireDate(record.validUntil, 'validUntil');
    }
    if ('notes' in record) {
      out.notes = requireString(record.notes, 'notes');
    }
    if ('orderId' in record) {
      out.orderId = requireObjectId(record.orderId, 'orderId');
    }

    return out;
  }

  private async findQuotationById(id: string): Promise<Quotation> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Quotation not found.');
    }
    const quotation = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!quotation) {
      throw new NotFoundError('Quotation not found.');
    }
    return quotation;
  }
}

/** Validates the priced buckets. Only the buckets present are returned. */
function toValidatedSplitup(value: unknown): Partial<QuotationSplitup> {
  const record = asRecord(value, '"splitup"');
  rejectUnknownFields(record, SPLITUP_FIELDS, '"splitup"');

  const out: Partial<QuotationSplitup> = {};
  for (const field of SPLITUP_FIELDS) {
    if (field in record) {
      (out as Record<SplitupField, number>)[field] = requireNumber(
        record[field],
        `splitup.${field}`,
      );
    }
  }

  return out;
}

/** Rounds to 2 decimals so repeated arithmetic cannot accumulate float noise. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Recomputes the grand total as the sum of the buckets, in place. */
function applyTotals(quotation: Quotation): void {
  const total = SPLITUP_FIELDS.reduce((sum, field) => sum + quotation.splitup[field], 0);
  quotation.price = round2(total);
}

/** Maps a stored Quotation to the JSON shape returned by the API. */
function toQuotationResponse(quotation: Quotation): QuotationResponse {
  return {
    id: quotation._id.toHexString(),
    splitup: { ...quotation.splitup },
    price: quotation.price,
    validUntil: quotation.validUntil?.toISOString(),
    notes: quotation.notes,
  };
}
