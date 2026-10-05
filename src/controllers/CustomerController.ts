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

import { CustomerService } from '../services/CustomerService';
import type {
  CreateCustomerRequest,
  CustomerResponse,
  DeleteCustomerResponse,
  UpdateCustomerRequest,
} from '../types/customer';

/**
 * Customer endpoints under /api/v1/customers.
 *
 * GET    /api/v1/customers      -> list customers
 * GET    /api/v1/customers/search?q=  -> search by name, contact, email or company
 * GET    /api/v1/customers/:id  -> fetch a single customer
 * POST   /api/v1/customers      -> create a customer
 * PATCH  /api/v1/customers/:id  -> partially update a customer
 * DELETE /api/v1/customers/:id  -> delete a customer
 *
 * HTTP concerns only; business logic lives in CustomerService.
 */
@Controller('/api/v1/customers')
@Service()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  list(): Promise<CustomerResponse[]> {
    return this.customerService.listCustomers();
  }

  /**
   * Declared before getOne so the static /search path is registered ahead of
   * the /:id pattern; otherwise "search" would be taken for a customer id.
   */
  @Get('/search')
  search(@QueryParam('q') q: string): Promise<CustomerResponse[]> {
    return this.customerService.searchCustomers(q);
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<CustomerResponse> {
    return this.customerService.getCustomer(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body({ required: true }) body: CreateCustomerRequest): Promise<CustomerResponse> {
    return this.customerService.createCustomer(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateCustomerRequest,
  ): Promise<CustomerResponse> {
    return this.customerService.updateCustomer(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteCustomerResponse> {
    return this.customerService.deleteCustomer(id);
  }
}
