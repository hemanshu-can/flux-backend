import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import type { FindManyOptions } from 'typeorm';

import { AppDataSource } from '../data-source';
import { Item } from '../models/items';
import type {
  CreateItemRequest,
  CreateItemsRequest,
  DeleteItemResponse,
  ItemResponse,
  UpdateItemRequest,
} from '../types/item';
import {
  asRecord,
  rejectUnknownFields,
  requireJsonObject,
  requireNumber,
  requireString,
} from './validation';

const FIELD_NAMES = [
  'name',
  'printingPricePerSheet',
  'designingChargePerSheet',
  'configuration',
] as const;

/** Fields of POST /api/v1/items/bulk: the batch's entries. */
const BATCH_FIELDS = ['items'] as const;

/**
 * Item CRUD: list, read, create, patch and delete printing products in the
 * "items" collection. Validation and normalization live here; the controller
 * only handles HTTP concerns.
 *
 * Creating is available one at a time and as a batch; both apply the same
 * field rules, and the batch applies them to every entry before it writes.
 */
@Service()
export class ItemService {
  private get repo() {
    return AppDataSource.getRepository(Item);
  }

  async listItems(): Promise<ItemResponse[]> {
    return (await this.repo.find()).map(toItemResponse);
  }

  async getItem(id: string): Promise<ItemResponse> {
    return toItemResponse(await this.findItemById(id));
  }

  /**
   * Case-insensitive partial search on the item name — the only free-text
   * field an item has. Prices and configuration are not searched.
   */
  async searchItems(term: string): Promise<ItemResponse[]> {
    const query = typeof term === 'string' ? term.trim() : '';
    if (query === '') {
      throw new BadRequestError('"q" is required.');
    }

    // MongoDB takes the WHERE clause as-is: an $or is what the driver receives,
    // even for the single name field. The pattern is escaped so the term is
    // matched literally rather than as a regular expression.
    const pattern = new RegExp(escapeRegExp(query), 'i');
    const where = { $or: [{ name: pattern }] };
    const items = await this.repo.find({ where } as FindManyOptions<Item>);
    return items.map(toItemResponse);
  }

  async createItem(input: CreateItemRequest): Promise<ItemResponse> {
    const values = this.validateFields(input);
    this.assertName(values);

    const saved = await this.repo.save(this.repo.create(values) as Item);
    return toItemResponse(saved);
  }

  /**
   * Creates one item per entry in `input.items`. Every entry is validated
   * before anything is written, so a bad entry at the end of a batch cannot
   * leave the entries before it stored and the rest not.
   */
  async createItems(input: CreateItemsRequest): Promise<ItemResponse[]> {
    const body = asRecord(input);
    rejectUnknownFields(body, BATCH_FIELDS);

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestError('"items" must be a non-empty array of items.');
    }

    const values = body.items.map((entry, index) => {
      const label = `items[${index}]`;
      const fields = this.validateFields(entry, label);
      this.assertName(fields, label);
      return fields;
    });

    const items = this.repo.create(values as Item[]);
    return (await this.repo.save(items)).map(toItemResponse);
  }

  async updateItem(id: string, input: UpdateItemRequest): Promise<ItemResponse> {
    const values = this.validateFields(input);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findItemById(id);

    Object.assign(current, values);
    return toItemResponse(await this.repo.save(current));
  }

  async deleteItem(id: string): Promise<DeleteItemResponse> {
    const item = await this.findItemById(id);
    await this.repo.delete({ _id: item._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /**
   * Validates a request body and returns the normalized mutable fields.
   * `label` names the record the fields came from when it is one of many — a
   * bulk create's entries — so errors point at the entry that failed.
   */
  private validateFields(input: unknown, label?: string): Partial<Item> {
    const record = asRecord(input, label ? `"${label}"` : undefined);
    rejectUnknownFields(record, FIELD_NAMES, label);

    /** Client-facing name of a field, prefixed when the record is one of many. */
    const nameOf = (field: string) => (label ? `${label}.${field}` : field);

    const out: Partial<Item> = {};

    if ('name' in record) {
      out.name = requireString(record.name, nameOf('name'));
    }
    if ('printingPricePerSheet' in record) {
      out.printingPricePerSheet = requireNumber(
        record.printingPricePerSheet,
        nameOf('printingPricePerSheet'),
      );
    }
    if ('designingChargePerSheet' in record) {
      out.designingChargePerSheet = requireNumber(
        record.designingChargePerSheet,
        nameOf('designingChargePerSheet'),
      );
    }
    if ('configuration' in record) {
      out.configuration = requireJsonObject(record.configuration, nameOf('configuration'));
    }

    return out;
  }

  /**
   * The one field an item cannot be created without. Kept out of
   * validateFields because a patch may legitimately omit it; `label` names the
   * entry when the check runs over a bulk create.
   */
  private assertName(values: Partial<Item>, label?: string): void {
    if (values.name === undefined) {
      throw new BadRequestError(label ? `"${label}.name" is required.` : '"name" is required.');
    }
  }

  private async findItemById(id: string): Promise<Item> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Item not found.');
    }
    const item = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!item) {
      throw new NotFoundError('Item not found.');
    }
    return item;
  }
}

/** Maps a stored Item to the JSON shape returned by the API. */
function toItemResponse(item: Item): ItemResponse {
  return {
    id: item._id.toHexString(),
    name: item.name,
    printingPricePerSheet: item.printingPricePerSheet,
    designingChargePerSheet: item.designingChargePerSheet,
    configuration: item.configuration,
  };
}

/**
 * Escapes regular-expression metacharacters so a search term is matched as
 * literal text — searching for "a+b" must not read "+" as a quantifier.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
