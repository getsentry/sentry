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
      if (key in stringAttributes) {
        return key;
      }

      if (key in numberAttributes) {
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

      return null;
    },
    [numberAttributes, stringAttributes]
  );
}
