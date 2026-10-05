import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  QueryParam,
} from 'routing-controllers';
import { Service } from 'typedi';

import { ItemService } from '../services/ItemService';
import type {
  CreateItemRequest,
  CreateItemsRequest,
  CreateItemsResponse,
  DeleteItemResponse,
  ItemResponse,
  UpdateItemRequest,
} from '../types/item';

/**
 * Item endpoints under /api/v1/items.
 *
 * GET    /api/v1/items      -> list items
 * GET    /api/v1/items/search?q=  -> search by item name
 * GET    /api/v1/items/:id  -> fetch a single item
 * POST   /api/v1/items      -> create an item
 * POST   /api/v1/items/bulk -> create one item per entry in the body
 * PATCH  /api/v1/items/:id  -> partially update an item
 * DELETE /api/v1/items/:id  -> delete an item
 *
 * HTTP concerns only; business logic lives in ItemService.
 */
@Controller('/api/v1/items')
@Service()
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get()
  list(): Promise<ItemResponse[]> {
    return this.itemService.listItems();
  }

  /**
   * Declared before getOne so the static /search path is registered ahead of
   * the /:id pattern; otherwise "search" would be taken for an item id.
   */
  @Get('/search')
  search(@QueryParam('q') q: string): Promise<ItemResponse[]> {
    return this.itemService.searchItems(q);
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<ItemResponse> {
    return this.itemService.getItem(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body({ required: true }) body: CreateItemRequest): Promise<ItemResponse> {
    return this.itemService.createItem(body);
  }

  /**
   * Creates one item per entry in `body.items`. Every entry is validated
   * before any is written: an invalid entry rejects the whole batch and
   * nothing is stored.
   */
  @Post('/bulk')
  @HttpCode(201)
  createBulk(@Body({ required: true }) body: CreateItemsRequest): Promise<CreateItemsResponse> {
    return this.itemService.createItems(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateItemRequest,
  ): Promise<ItemResponse> {
    return this.itemService.updateItem(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteItemResponse> {
    return this.itemService.deleteItem(id);
  }
}
