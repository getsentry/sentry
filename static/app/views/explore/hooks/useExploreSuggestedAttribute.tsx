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

      // Resolve a tag array's root name to its backend key form, eg.
      // `foo` -> `tags[foo,array]`.
      const explicitArrayAttribute = `tags[${key},array]`;
      if (explicitArrayAttribute in arrayAttributes) {
        return explicitArrayAttribute;
      }

      return null;
    },
    [booleanAttributes, numberAttributes, stringAttributes, arrayAttributes]
  );
}
