import {useCallback} from 'react';

import type {TagCollection} from 'sentry/types/group';

interface UseExploreSuggestedAttributeOptions {
  booleanAttributes: TagCollection;
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
  arrayAttributes?: TagCollection;
}

export function useExploreSuggestedAttribute({
  numberAttributes,
  stringAttributes,
  booleanAttributes,
  arrayAttributes = {},
}: UseExploreSuggestedAttributeOptions) {
  return useCallback(
    (key: string): string | null => {
      if (key in stringAttributes) {
        return key;
      }

      if (key in numberAttributes) {
        return key;
      }

      if (key in booleanAttributes) {
        return key;
      }

      if (key in arrayAttributes) {
        return key;
      }

      const explicitStringAttribute = `tags[${key},string]`;
      if (explicitStringAttribute in stringAttributes) {
        return explicitStringAttribute;
      }

      const explicitNumberAttribute = `tags[${key},number]`;
      if (explicitNumberAttribute in numberAttributes) {
        return explicitNumberAttribute;
      }

      const explicitBooleanAttribute = `tags[${key},boolean]`;
      if (explicitBooleanAttribute in booleanAttributes) {
        return explicitBooleanAttribute;
      }

      // Array membership requires the `[*]` operator, so only resolve keys that
      // carry it — mapping the base to its backend key while keeping `[*]` (eg.
      // `foo[*]` -> `tags[foo,array][*]`). A bare `foo` (no `[*]`) is intentionally
      // not resolved, so it never becomes a membership filter on its own.
      if (key.endsWith('[*]')) {
        const base = key.slice(0, -'[*]'.length);
        if (base in arrayAttributes) {
          return `${base}[*]`;
        }
        const explicitArrayAttribute = `tags[${base},array]`;
        if (explicitArrayAttribute in arrayAttributes) {
          return `${explicitArrayAttribute}[*]`;
        }
      }

      return null;
    },
    [booleanAttributes, numberAttributes, stringAttributes, arrayAttributes]
  );
}
