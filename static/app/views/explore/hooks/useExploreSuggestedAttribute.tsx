import {useCallback} from 'react';

import type {TagCollection} from 'sentry/types/group';

interface UseExploreSuggestedAttributeOptions {
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
}

export function useExploreSuggestedAttribute({
  numberAttributes,
  stringAttributes,
}: UseExploreSuggestedAttributeOptions) {
  return useCallback(
    (key: string): string | null => {
      if (stringAttributes.hasOwnProperty(key)) {
        return key;
      }

      if (numberAttributes.hasOwnProperty(key)) {
        return key;
      }

      const explicitStringAttribute = `tags[${key},string]`;
      if (stringAttributes.hasOwnProperty(explicitStringAttribute)) {
        return explicitStringAttribute;
      }

      const explicitNumberAttribute = `tags[${key},number]`;
      if (numberAttributes.hasOwnProperty(explicitNumberAttribute)) {
        return explicitNumberAttribute;
      }

      return null;
    },
    [numberAttributes, stringAttributes]
  );
}
