import { ObjectId } from 'mongodb';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import { Employee } from '../models/employees';
import { EMPLOYEE_TYPE } from '../types/employee';
import type {
  CreateEmployeeRequest,
  DeleteEmployeeResponse,
  EmployeeResponse,
  UpdateEmployeeRequest,
} from '../types/employee';
import {
  asRecord,
  optionalString,
  rejectUnknownFields,
  requireEmail,
  requireEnum,
  requireString,
} from './validation';

const FIELD_NAMES = ['firstName', 'lastName', 'email', 'employeeType'] as const;

/**
 * Employee CRUD: list, read, create, patch and delete staff in the "employees"
 * collection. Validation and normalization live here; the controller only
 * handles HTTP concerns.
 */
@Service()
export class EmployeeService {
  private get repo() {
    return AppDataSource.getRepository(Employee);
  }

  async listEmployees(): Promise<EmployeeResponse[]> {
    return (await this.repo.find()).map(toEmployeeResponse);
  }

  async getEmployee(id: string): Promise<EmployeeResponse> {
    return toEmployeeResponse(await this.findEmployeeById(id));
  }

  async createEmployee(input: CreateEmployeeRequest): Promise<EmployeeResponse> {
    const values = this.validateFields(input);

    if (values.firstName === undefined) {
      throw new BadRequestError('"firstName" is required.');
    }
    if (values.email === undefined) {
      throw new BadRequestError('"email" is required.');
    }
    if (values.employeeType === undefined) {
      throw new BadRequestError('"employeeType" is required.');
    }

    await this.assertEmailAvailable(values.email);

    const saved = await this.repo.save(this.repo.create(values) as Employee);
    return toEmployeeResponse(saved);
  }

  async updateEmployee(id: string, input: UpdateEmployeeRequest): Promise<EmployeeResponse> {
    const values = this.validateFields(input);
    if (Object.keys(values).length === 0) {
      throw new BadRequestError('Provide at least one field to update.');
    }

    const current = await this.findEmployeeById(id);

    if (values.email !== undefined && values.email !== current.email) {
      await this.assertEmailAvailable(values.email);
    }

    Object.assign(current, values);
    return toEmployeeResponse(await this.repo.save(current));
  }

  async deleteEmployee(id: string): Promise<DeleteEmployeeResponse> {
    const employee = await this.findEmployeeById(id);
    await this.repo.delete({ _id: employee._id });
    return { deleted: true, id };
  }

  // ---- validation & normalization ---------------------------------------

  /** Validates a request body and returns the normalized mutable fields. */
  private validateFields(input: unknown): Partial<Employee> {
    const record = asRecord(input);
    rejectUnknownFields(record, FIELD_NAMES);

    const out: Partial<Employee> = {};

    if ('firstName' in record) {
      out.firstName = requireString(record.firstName, 'firstName');
    }
    if ('lastName' in record) {
      // Blank means "no surname given", so it is dropped rather than stored
      // as an empty string — the model and response contract leave it optional.
      const lastName = optionalString(record.lastName, 'lastName');
      if (lastName !== undefined) {
        out.lastName = lastName;
      }
    }
    if ('email' in record) {
      out.email = requireEmail(record.email);
    }
    if ('employeeType' in record) {
      out.employeeType = requireEnum(record.employeeType, EMPLOYEE_TYPE, 'employeeType');
    }

    return out;
  }

  /** An email identifies one employee, so it must not collide. */
  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestError(`An employee with email "${email}" already exists.`);
    }
  }

  private async findEmployeeById(id: string): Promise<Employee> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundError('Employee not found.');
    }
    const employee = await this.repo.findOne({ where: { _id: new ObjectId(id) } });
    if (!employee) {
      throw new NotFoundError('Employee not found.');
    }
    return employee;
  }
}

/** Maps a stored Employee to the JSON shape returned by the API. */
function toEmployeeResponse(employee: Employee): EmployeeResponse {
  return {
    id: employee._id.toHexString(),
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    employeeType: employee.employeeType,
  };
}
