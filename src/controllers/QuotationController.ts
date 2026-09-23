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

import { QuotationService } from '../services/QuotationService';
import type {
  CreateQuotationRequest,
  DeleteQuotationResponse,
  QuotationResponse,
  UpdateQuotationRequest,
} from '../types/quotation';

/**
 * Quotation endpoints under /api/v1/quotations.
 *
 * GET    /api/v1/quotations      -> list quotations
 * GET    /api/v1/quotations/:id  -> fetch a single quotation
 * POST   /api/v1/quotations      -> create a quotation
 * PATCH  /api/v1/quotations/:id  -> partially update a quotation
 * DELETE /api/v1/quotations/:id  -> delete a quotation
 *
 * Line amounts, tax and the grand total are computed server-side, so they are
 * not accepted in the request body.
 *
 * HTTP concerns only; business logic lives in QuotationService.
 */
@Controller('/api/v1/quotations')
@Service()
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get()
  list(): Promise<QuotationResponse[]> {
    return this.quotationService.listQuotations();
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<QuotationResponse> {
    return this.quotationService.getQuotation(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body({ required: true }) body: CreateQuotationRequest): Promise<QuotationResponse> {
    return this.quotationService.createQuotation(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateQuotationRequest,
  ): Promise<QuotationResponse> {
    return this.quotationService.updateQuotation(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteQuotationResponse> {
    return this.quotationService.deleteQuotation(id);
  }
}
