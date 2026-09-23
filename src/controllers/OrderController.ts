import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from 'routing-controllers';
import { Service } from 'typedi';

import { OrderService } from '../services/OrderService';
import type {
  CreateOrderRequest,
  DeleteOrderResponse,
  OrderResponse,
  UpdateOrderRequest,
} from '../types/order';

/**
 * Order endpoints under /api/v1/orders.
 *
 * GET    /api/v1/orders      -> list orders
 * GET    /api/v1/orders/:id  -> fetch a single order
 * POST   /api/v1/orders      -> create an order
 * PATCH  /api/v1/orders/:id  -> partially update an order
 * DELETE /api/v1/orders/:id  -> delete an order
 *
 * HTTP concerns only; business logic lives in OrderService.
 */
@Controller('/api/v1/orders')
@Service()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(): Promise<OrderResponse[]> {
    return this.orderService.listOrders();
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<OrderResponse> {
    return this.orderService.getOrder(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body({ required: true }) body: CreateOrderRequest): Promise<OrderResponse> {
    return this.orderService.createOrder(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateOrderRequest,
  ): Promise<OrderResponse> {
    return this.orderService.updateOrder(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteOrderResponse> {
    return this.orderService.deleteOrder(id);
  }
}
