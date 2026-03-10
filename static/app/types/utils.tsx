import type {Organization, SharedViewOrganization} from './organization';

// from:
// - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
// - https://www.typescriptlang.org/play/#example/assertion-functions

// This declares a function which asserts that the expression called
// value is true:
export function assert(_value: unknown): asserts _value {}

export function isNotSharedOrganization(
  maybe: Organization | SharedViewOrganization
): maybe is Organization {
  return typeof (maybe as Organization).id !== 'undefined';
}

export type DeepPartial<T> =
  T extends Record<PropertyKey, any>
    ? {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

export function isArrayOf<T>(
  value: unknown,
  predicate: (x: unknown) => x is T
): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
