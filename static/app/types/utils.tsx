import type {Organization, SharedViewOrganization} from './organization';

// from:
// - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
// - https://www.typescriptlang.org/play/#example/assertion-functions

// This declares a function which asserts that the expression called
// value is true:
export function assert(_value: unknown): asserts _value {}

// This declares a function which asserts that the expression called
// value is of type Type:
export function assertType<Type>(_value: unknown): asserts _value is Type {}

export function isNotSharedOrganization(
  maybe: Organization | SharedViewOrganization
): maybe is Organization {
  return typeof (maybe as Organization).id !== 'undefined';
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
