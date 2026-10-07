import {useCallback} from 'react';

import {
  addArrayMembershipOperator,
  stripArrayMembershipOperator,
} from 'sentry/components/searchSyntax/utils';
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

      // Array attributes filter by membership. Resolve both the `[*]` form and
      // the bare root name to the backend key; getInitialFilterText adds the
      // `[*]` operator, so plain `:` and `[*]:` both produce a membership filter.
      const base = stripArrayMembershipOperator(key);
      if (base !== key) {
        if (base in arrayAttributes) {
          return addArrayMembershipOperator(base);
        }
        const explicitArrayWithOperator = `tags[${base},array]`;
        if (explicitArrayWithOperator in arrayAttributes) {
          return addArrayMembershipOperator(explicitArrayWithOperator);
        }
      }

      const explicitArrayAttribute = `tags[${key},array]`;
      if (explicitArrayAttribute in arrayAttributes) {
        return explicitArrayAttribute;
      }

      return null;
    },
    [booleanAttributes, numberAttributes, stringAttributes, arrayAttributes]
  );
}
