import { ObjectId } from 'mongodb';
import { BadRequestError } from 'routing-controllers';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

import { AppDataSource } from '../data-source';

/**
 * Field validators shared by every service.
 *
 * Deviation from pulse-backend: pulse duplicates helpers like these inside each
 * service (OwnerService and OwnersImportService each define their own phone
 * normalization). flux has five CRUD services, so the shared rules live here.
 * The normalization semantics themselves match pulse's OwnerService.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Phone digits, no "+": 7..15 long, not starting with 0. */
const PHONE_RE = /^[1-9]\d{6,14}$/;
/** Strict 24-char hex form, so a short id cannot silently become a different ObjectId. */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
/** Indian GSTIN: 2-digit state code followed by 12 alphanumerics. */
const GSTIN_RE = /^\d{2}[A-Z0-9]{12}$/;
/** Indian postal code: exactly 6 digits. */
const PINCODE_RE = /^\d{6}$/;

/** Asserts the input is a plain JSON object (not null, not an array). */
export function asRecord(input: unknown, label = 'Request body'): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestError(`${label} must be a JSON object.`);
  }
  return input as Record<string, unknown>;
}

/** Rejects keys outside `allowed`, so unexpected fields cannot reach the database. */
export function rejectUnknownFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new BadRequestError(`Unknown field "${key}".`);
    }
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestError(`"${field}" must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * Like requireString, but absent or blank input means "not provided" rather
 * than an error. Callers omit the field from the stored document instead of
 * persisting an empty string, so a blank value never becomes stored data.
 */
export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestError(`"${field}" must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function requireEmail(value: unknown, field = 'email'): string {
  const email = requireString(value, field).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new BadRequestError(`Invalid ${field} "${value}".`);
  }
  return email;
}

/** Normalizes a phone number to bare digits. */
export function requireMobile(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestError(`"${field}" must be a string.`);
  }
  const digits = value.replace(/^\+/, '').replace(/[\s\-().]/g, '');
  if (!PHONE_RE.test(digits)) {
    throw new BadRequestError(`Invalid ${field} "${value}".`);
  }
  return digits;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestError(`"${field}" must be a non-negative number.`);
  }
  return value;
}

export function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BadRequestError(`"${field}" must be a non-negative integer.`);
  }
  return value;
}

export function requirePositiveInteger(value: unknown, field: string): number {
  const count = requireInteger(value, field);
  if (count < 1) {
    throw new BadRequestError(`"${field}" must be at least 1.`);
  }
  return count;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new BadRequestError(`"${field}" must be a boolean.`);
  }
  return value;
}

export function requireEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new BadRequestError(`"${field}" must be one of: ${values.join(', ')}.`);
  }
  return value as T;
}

/** Accepts any non-null, non-array object — a free-form JSON bag. */
export function requireJsonObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError(`"${field}" must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

/** Uppercased Indian GSTIN. */
export function requireGstNumber(value: unknown, field: string): string {
  const gst = requireString(value, field).toUpperCase();
  if (!GSTIN_RE.test(gst)) {
    throw new BadRequestError(`Invalid ${field} "${value}".`);
  }
  return gst;
}

/** 6-digit Indian postal code, kept as a string so leading zeros survive. */
export function requirePincode(value: unknown, field: string): string {
  if (typeof value !== 'string' || !PINCODE_RE.test(value.trim())) {
    throw new BadRequestError(`"${field}" must be a 6-digit pincode.`);
  }
  return value.trim();
}

/** Parses an ISO-8601 date string into a Date. */
export function requireDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') {
    throw new BadRequestError(`"${field}" must be an ISO date string.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`Invalid ${field} "${value}".`);
  }
  return date;
}

/** Validates a 24-char hex id supplied by a client. */
export function requireObjectId(value: unknown, field: string): ObjectId {
  if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) {
    throw new BadRequestError(`"${field}" must be a 24-character hex id.`);
  }
  return new ObjectId(value);
}

/** Minimal repository surface needed to check that a referenced document exists. */
interface IdLookup {
  findOne(options: { where: { _id: ObjectId } }): Promise<unknown>;
}

/**
 * Rejects references to documents that do not exist. MongoDB has no foreign
 * keys, so without this an order can point at a customer that was never created
 * or has since been deleted.
 */
export async function assertReferenceExists(
  entity: EntityTarget<ObjectLiteral>,
  id: ObjectId | undefined,
  field: string,
  label: string,
): Promise<void> {
  if (id === undefined) {
    return;
  }
  const repo = AppDataSource.getRepository(entity) as unknown as IdLookup;
  const found = await repo.findOne({ where: { _id: id } });
  if (!found) {
    throw new BadRequestError(`"${field}" points at a ${label} that does not exist.`);
  }
}
