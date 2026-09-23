import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Customer } from '../models/customers';
import { Quotation } from '../models/quotations';
import type { QuotationLine } from '../models/quotations';
import type {
  CreateQuotationRequest,
  DeleteQuotationResponse,
  QuotationResponse,
  UpdateQuotationRequest,
} from '../types/quotation';
import {
  asRecord,
  assertReferenceExists,
  rejectUnknownFields,
  requireDate,
  requireNumber,
  requireObjectId,
  requirePositiveInteger,
  requireString,
} from './validation';

const FIELD_NAMES = ['customerId', 'splitup', 'tax', 'validUntil', 'notes'] as const;
const LINE_FIELDS = ['itemId', 'description', 'quantity', 'unitPrice'] as const;
const TAX_FIELDS = ['rate'] as const;

/**
 * Quotation CRUD: list, read, create, patch and delete quotes in the
 * "quotations" collection.
 *
 * Clients supply the lines, the tax rate and the customer; every amount — each
 * line's amount, the tax amount and the grand total stored as "price" — is
 * derived here so the figures can never disagree with each other.
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
    const values = this.validateFields(input);

    if (values.customerId === undefined) {
      throw new BadRequestError('"customerId" is required.');
    }
    if (values.splitup === undefined || values.splitup.length === 0) {
      throw new BadRequestError('"splitup" must contain at least one line.');
    }

    await assertReferenceExists(Customer, values.customerId, 'customerId', 'customer');

    const quotation = this.repo.create({
      ...values,
      tax: values.tax ?? { rate: 0, amount: 0 },
    } as Quotation);

    applyTotals(quotation);
    return toQuotationResponse(await this.repo.save(quotation));
  }

  async updateQuotation(id: string, input: UpdateQuotationRequest): Promise<QuotationResponse> {
    const values = this.validateFields(input);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }
    if (values.splitup !== undefined && values.splitup.length === 0) {
      throw new BadRequestError('"splitup" must contain at least one line.');
    }

    const current = await this.findQuotationById(id);

    if (values.customerId !== undefined && !values.customerId.equals(current.customerId)) {
      await assertReferenceExists(Customer, values.customerId, 'customerId', 'customer');
    }

    Object.assign(current, values);

    // Amounts depend on both the lines and the rate, so recompute from the
    // merged document rather than from this patch alone.
    applyTotals(current);
    return toQuotationResponse(await this.repo.save(current));
  }

  async deleteQuotation(id: string): Promise<DeleteQuotationResponse> {
    const quotation = await this.findQuotationById(id);
    await this.repo.delete({ _id: quotation._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<Quotation> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<Quotation> = {};

    if ('customerId' in record) {
      out.customerId = requireObjectId(record.customerId, 'customerId');
    }
    if ('splitup' in record) {
      out.splitup = toValidatedLines(record.splitup);
    }
    if ('tax' in record) {
      const tax = asRecord(record.tax, '"tax"');
      rejectUnknownFields(tax, TAX_FIELDS);
      // The amount is derived later; it is never accepted from the client.
      out.tax = { rate: requireNumber(tax.rate, 'tax.rate'), amount: 0 };
    }
    if ('validUntil' in record) {
      out.validUntil = requireDate(record.validUntil, 'validUntil');
    }
    if ('notes' in record) {
      out.notes = requireString(record.notes, 'notes');
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

/** Validates the priced lines. Amounts are filled in later by applyTotals. */
function toValidatedLines(value: unknown): QuotationLine[] {
  if (!Array.isArray(value)) {
    throw new BadRequestError('"splitup" must be an array of lines.');
  }

  return value.map((line, index) => {
    const record = asRecord(line, `"splitup[${index}]"`);
    rejectUnknownFields(record, LINE_FIELDS);

    const parsed: QuotationLine = {
      description: requireString(record.description, `splitup[${index}].description`),
      quantity: requirePositiveInteger(record.quantity, `splitup[${index}].quantity`),
      unitPrice: requireNumber(record.unitPrice, `splitup[${index}].unitPrice`),
      amount: 0,
    };

    if (record.itemId !== undefined) {
      parsed.itemId = requireObjectId(record.itemId, `splitup[${index}].itemId`);
    }

    return parsed;
  });
}

/** Rounds to 2 decimals so repeated arithmetic cannot accumulate float noise. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Recomputes line amounts, the tax amount and the grand total, in place. */
function applyTotals(quotation: Quotation): void {
  quotation.splitup = quotation.splitup.map((line) => ({
    ...line,
    amount: round2(line.quantity * line.unitPrice),
  }));

  const subtotal = quotation.splitup.reduce((sum, line) => sum + line.amount, 0);
  quotation.tax = {
    rate: quotation.tax.rate,
    amount: round2((subtotal * quotation.tax.rate) / 100),
  };
  quotation.price = round2(subtotal + quotation.tax.amount);
}

/** Maps a stored Quotation to the JSON shape returned by the API. */
function toQuotationResponse(quotation: Quotation): QuotationResponse {
  return {
    id: quotation._id.toHexString(),
    customerId: quotation.customerId.toHexString(),
    splitup: quotation.splitup.map((line) => ({
      itemId: line.itemId?.toHexString(),
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    })),
    tax: { rate: quotation.tax.rate, amount: quotation.tax.amount },
    price: quotation.price,
    validUntil: quotation.validUntil?.toISOString(),
    notes: quotation.notes,
  };
}
