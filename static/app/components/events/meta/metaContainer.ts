import {Meta} from 'sentry/types';

declare const __brand: unique symbol;

/**
 * Nested object found within an event's "_meta" field.
 *
 * It should match the following pseudo type (currently impossible to express in TS [^1]):
 *
 *    ```ts
 *    type MetaContainer = {''?: Partial<Meta>, [key: string ~ '']: MetaContainer} | undefined}
 *    ```
 *
 * Instead of providing inaccurate types, we make the type opaque, leveraging "branding" [^2]
 * and helper methods for accessing the relevant parts of the object in a typesafe way.
 *
 * - Use {@link getMeta} to access the Meta of the current object.
 * - Use {@link getChildMetaContainer} to query for a nested Meta (for arrays / objects).
 * - Use {@link castAsMetaContainer} to cast an object as MetaContainer.
 *
 * [^1]: https://github.com/microsoft/TypeScript/issues/4196#issuecomment-260014226
 * [^2]: https://egghead.io/blog/using-branded-types-in-typescript
 */
export type MetaContainer =
  | {[key: string]: unknown; readonly [__brand]: 'MetaContainer'}
  | undefined;

export function castAsMetaContainer(metaContainer: any): MetaContainer {
  return metaContainer;
}

/**
 * @param path - should not contain `''` - use `getMeta` instead.
 */
export function getChildMetaContainer(
  metaContainer: MetaContainer,
  ...path: Array<string | number>
): MetaContainer {
  let current: MetaContainer = metaContainer;
  for (const key of path) {
    if (!current) {
      return undefined;
    }
    if (key === '') {
      return undefined;
    }
    current = current[key] as MetaContainer;
  }
  return current;
}

export function getMeta(metaContainer: MetaContainer): Partial<Meta> | undefined {
  return metaContainer?.[''] as Partial<Meta> | undefined;
}
