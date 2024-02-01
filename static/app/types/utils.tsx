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

// https://github.com/microsoft/TypeScript/pull/40002
export type FixedTuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []> // eslint-disable-line @typescript-eslint/ban-types
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;
