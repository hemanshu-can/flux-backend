/**
 * Contracts for the employee endpoints on EmployeeController
 * (GET/POST/PATCH/DELETE under /api/v1/employees).
 */

/** Job roles an employee can hold. Runtime list and source of the union. */
export const EMPLOYEE_TYPE = ['admin', 'sales', 'designer', 'production', 'accounts'] as const;

export type EmployeeType = (typeof EMPLOYEE_TYPE)[number];

/** Fields a client may set when creating or editing an employee. */
export interface EmployeeInput {
  firstName: string;
  lastName?: string;
  email: string;
  employeeType: EmployeeType;
}

/** Body of POST /api/v1/employees. */
export type CreateEmployeeRequest = EmployeeInput;

/** Body of PATCH /api/v1/employees/:id — only provided fields are updated. */
export type UpdateEmployeeRequest = Partial<EmployeeInput>;

/** An employee as returned by the API. */
export interface EmployeeResponse {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  employeeType: EmployeeType;
}

/** Response of DELETE /api/v1/employees/:id. */
export interface DeleteEmployeeResponse {
  deleted: true;
  id: string;
}
