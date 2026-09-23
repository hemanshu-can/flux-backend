import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Item } from '../models/items';
import type {
  CreateItemRequest,
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

/**
 * Item CRUD: list, read, create, patch and delete printing products in the
 * "items" collection. Validation and normalization live here; the controller
 * only handles HTTP concerns.
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

  async createItem(input: CreateItemRequest): Promise<ItemResponse> {
    const values = this.validateFields(input);

    if (values.name === undefined) {
      throw new BadRequestError('"name" is required.');
    }
    if (values.printingPricePerSheet === undefined) {
      throw new BadRequestError('"printingPricePerSheet" is required.');
    }
    if (values.designingChargePerSheet === undefined) {
      throw new BadRequestError('"designingChargePerSheet" is required.');
    }

    const saved = await this.repo.save(this.repo.create(values) as Item);
    return toItemResponse(saved);
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

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<Item> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<Item> = {};

    if ('name' in record) {
      out.name = requireString(record.name, 'name');
    }
    if ('printingPricePerSheet' in record) {
      out.printingPricePerSheet = requireNumber(
        record.printingPricePerSheet,
        'printingPricePerSheet',
      );
    }
    if ('designingChargePerSheet' in record) {
      out.designingChargePerSheet = requireNumber(
        record.designingChargePerSheet,
        'designingChargePerSheet',
      );
    }
    if ('configuration' in record) {
      out.configuration = requireJsonObject(record.configuration, 'configuration');
    }

    return out;
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
