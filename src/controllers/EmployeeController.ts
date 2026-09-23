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

import { EmployeeService } from '../services/EmployeeService';
import type {
  CreateEmployeeRequest,
  DeleteEmployeeResponse,
  EmployeeResponse,
  UpdateEmployeeRequest,
} from '../types/employee';

/**
 * Employee endpoints under /api/v1/employees.
 *
 * GET    /api/v1/employees      -> list employees
 * GET    /api/v1/employees/:id  -> fetch a single employee
 * POST   /api/v1/employees      -> create an employee
 * PATCH  /api/v1/employees/:id  -> partially update an employee
 * DELETE /api/v1/employees/:id  -> delete an employee
 *
 * HTTP concerns only; business logic lives in EmployeeService.
 */
@Controller('/api/v1/employees')
@Service()
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  list(): Promise<EmployeeResponse[]> {
    return this.employeeService.listEmployees();
  }

  @Get('/:id')
  getOne(@Param('id') id: string): Promise<EmployeeResponse> {
    return this.employeeService.getEmployee(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body({ required: true }) body: CreateEmployeeRequest): Promise<EmployeeResponse> {
    return this.employeeService.createEmployee(body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body({ required: true }) body: UpdateEmployeeRequest,
  ): Promise<EmployeeResponse> {
    return this.employeeService.updateEmployee(id, body);
  }

  @Delete('/:id')
  remove(@Param('id') id: string): Promise<DeleteEmployeeResponse> {
    return this.employeeService.deleteEmployee(id);
  }
}
