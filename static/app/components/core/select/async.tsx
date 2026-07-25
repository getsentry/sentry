import {useEffect, useRef, useState} from 'react';
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
  ref?: React.Ref<typeof ReactSelect<GeneralSelectValue>>;
}

const DEBOUNCE_MS = 250;

/**
 * Performs an API request to `url` to fetch the options
 */
export function SelectAsync<TData = unknown>({
  url,
  value,
  onQuery,
  onResults,
  ref,
  placeholder = '--',
  defaultOptions = true,
  ...props
}: SelectAsyncControlProps<TData> & {placeholder?: React.ReactNode}) {
  const [inputQuery, setInputQuery] = useState('');
  const debouncedQuery = useDebouncedValue(inputQuery, DEBOUNCE_MS);
  const [options, setOptions] = useState<Result[]>([]);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const queryParams =
    typeof onQuery === 'function' ? onQuery(debouncedQuery) : {query: debouncedQuery};

  const {data, isPending, isError, error} = useQuery({
    // `url` is a dynamic prop (not a KnownSentryApiUrl), so we bypass the branded
    // ApiQueryKey constraint with a double cast — the same pattern used in the codebase
    // for runtime URLs (e.g. useAskSeerPolling.tsx).
    queryKey: normalizeQueryKey([url, {query: queryParams}] as unknown as ApiQueryKey),
    queryFn: apiFetch<TData>,
    enabled: defaultOptions !== false || debouncedQuery.length > 0,
    staleTime: 0,
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

  useEffect(() => {
    if (!data) {
      return;
    }
    // `onResults` is called here (in an effect) rather than in `select`, since
    // callers (e.g. SelectAsyncField) update state on a *different* component
    // from within it — `select` can run during render, which React disallows
    // for cross-component state updates. `onResultsRef` keeps this effect from
    // re-firing when callers pass a new `onResults` closure every render.
    const currentOnResults = onResultsRef.current;
    setOptions(
      typeof currentOnResults === 'function'
        ? currentOnResults(data.json)
        : (data.json as unknown as Result[])
    );
  }, [data]);

  return (
    <Select
      key={String(value)}
      ref={ref}
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
