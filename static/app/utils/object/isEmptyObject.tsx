import type {Primitive, UnknownArray, UnknownMap, UnknownSet} from 'type-fest';

type EmptyObjectInput<T> = T extends UnknownMap | UnknownSet | UnknownArray | Primitive
  ? never
  : T;

export function isEmptyObject<T>(obj?: T & EmptyObjectInput<T>): boolean {
  const value = obj ?? {};

  for (const prop in value) {
    if (Object.hasOwn(value, prop)) {
      return false;
    }
  }

  return true;
}
