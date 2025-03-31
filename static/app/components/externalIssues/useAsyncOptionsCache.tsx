import {useCallback, useState} from 'react';

import type {Choices, SelectValue} from 'sentry/types/core';
import type {IssueConfigField} from 'sentry/types/integrations';

/**
 * Manages state cache of options fetched for async fields.
 * This is used to avoid fetching the same options multiple times.
 */
export function useAsyncOptionsCache(initialCache?: Record<string, Choices>) {
  const [asyncOptions, setAsyncOptions] = useState<Record<string, Choices>>(
    initialCache || {}
  );

  const updateCache = useCallback(
    ({
      field,
      result,
    }: {
      field: IssueConfigField;
      result: Array<SelectValue<string | number>>;
    }) => {
      setAsyncOptions({
        ...asyncOptions,
        [field.name]: result.map(obj => [obj.value, obj.label]) as Choices,
      });
    },
    [asyncOptions]
  );

  return {cache: asyncOptions, updateCache};
}
