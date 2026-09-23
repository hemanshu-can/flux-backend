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

import { OutsourcingPartnerService } from '../services/OutsourcingPartnerService';
import type {
  CreateOutsourcingPartnerRequest,
  DeleteOutsourcingPartnerResponse,
  OutsourcingPartnerResponse,
  UpdateOutsourcingPartnerRequest,
} from '../types/outsourcingPartner';

/**
 * Outsourcing partner endpoints under /api/v1/outsourcing-partners.
 *
 * GET    /api/v1/outsourcing-partners      -> list outsourcing partners
 * GET    /api/v1/outsourcing-partners/:id  -> fetch a single outsourcing partner
 * POST   /api/v1/outsourcing-partners      -> create an outsourcing partner
 * PATCH  /api/v1/outsourcing-partners/:id  -> partially update an outsourcing partner
 * DELETE /api/v1/outsourcing-partners/:id  -> delete an outsourcing partner
 *
 * HTTP concerns only; business logic lives in OutsourcingPartnerService.
 */
@Controller('/api/v1/outsourcing-partners')
@Service()
export class OutsourcingPartnerController {
  constructor(private readonly outsourcingPartnerService: OutsourcingPartnerService) {}

  @Get()
  list(): Promise<OutsourcingPartnerResponse[]> {
    return this.outsourcingPartnerService.listOutsourcingPartners();
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<OutsourcingPartnerResponse> {
    return this.outsourcingPartnerService.getOutsourcingPartner(id);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body({ required: true }) body: CreateOutsourcingPartnerRequest,
  ): Promise<OutsourcingPartnerResponse> {
    return this.outsourcingPartnerService.createOutsourcingPartner(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateOutsourcingPartnerRequest,
  ): Promise<OutsourcingPartnerResponse> {
    return this.outsourcingPartnerService.updateOutsourcingPartner(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteOutsourcingPartnerResponse> {
    return this.outsourcingPartnerService.deleteOutsourcingPartner(id);
  }
}
