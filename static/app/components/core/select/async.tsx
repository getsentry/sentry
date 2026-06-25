import {forwardRef, useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ReactSelect} from 'sentry/components/forms/controls/reactSelectWrapper';
import {t} from 'sentry/locale';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {normalizeQueryKey} from 'sentry/utils/api/apiQueryKey';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {ControlProps, GeneralSelectValue} from './';
import {Select} from './';

export type Result = {
  label: string | React.ReactNode;
  value: string;
};

export interface SelectAsyncControlProps<TData = any> {
  // TODO(ts): Improve data type
  onQuery: (query: string | undefined) => Record<string, unknown>;
  onResults: (data: TData) => Result[];
  url: string;
  value: ControlProps['value'];
  defaultOptions?: boolean | GeneralSelectValue[];
  forwardedRef?: React.Ref<typeof ReactSelect<GeneralSelectValue>>;
  placeholder?: React.ReactNode;
}

const DEBOUNCE_MS = 250;

/**
 * Performs an API request to `url` to fetch the options
 */
function SelectAsyncControl<TData = unknown>({
  url,
  value,
  onQuery,
  onResults,
  forwardedRef,
  placeholder = '--',
  defaultOptions = true,
  ...props
}: SelectAsyncControlProps<TData>) {
  const [inputQuery, setInputQuery] = useState('');
  const debouncedQuery = useDebouncedValue(inputQuery, DEBOUNCE_MS);

  const queryParams =
    typeof onQuery === 'function' ? onQuery(debouncedQuery) : {query: debouncedQuery};

  const {
    data: options = [],
    isPending,
    isError,
    error,
  } = useQuery({
    // `url` is a dynamic prop (not a KnownSentryApiUrl), so we bypass the branded
    // ApiQueryKey constraint with a double cast — the same pattern used in the codebase
    // for runtime URLs (e.g. useAskSeerPolling.tsx).
    queryKey: normalizeQueryKey([url, {query: queryParams}] as unknown as ApiQueryKey),
    queryFn: apiFetch<TData>,
    enabled: defaultOptions !== false || debouncedQuery.length > 0,
    staleTime: 0,
    select: ({json}) =>
      typeof onResults === 'function' ? onResults(json) : (json as unknown as Result[]),
  });

  useEffect(() => {
    if (!isError) {
      return;
    }
    addErrorMessage(t('There was a problem with the request.'));
    handleXhrErrorResponse('SelectAsync failed', error as RequestError);
    // eslint-disable-next-line no-console
    console.error(error);
  }, [isError, error]);

  return (
    <Select
      key={String(value)}
      ref={forwardedRef}
      value={value}
      placeholder={placeholder}
      options={options}
      // Disable client-side filtering: the server already filters by the query,
      // and local re-filtering would discard valid results during debounce transitions.
      filterOption={() => true}
      isLoading={isPending || inputQuery !== debouncedQuery}
      onInputChange={(newQuery, actionMeta) => {
        if (actionMeta.action === 'input-change') {
          setInputQuery(newQuery);
        }
      }}
      {...props}
    />
  );
}

export const SelectAsync = forwardRef((p: any, ref: any) => {
  return <SelectAsyncControl {...p} forwardedRef={ref} />;
});
