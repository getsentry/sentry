import {forwardRef, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ReactSelect} from 'sentry/components/forms/controls/reactSelectWrapper';
import {t} from 'sentry/locale';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

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
  // The API client clears in-flight requests automatically on unmount
  const api = useApi();
  const cache = useRef<Record<string, unknown>>({});
  const [query, setQuery] = useState('');

  // Keep the latest values accessible inside the debounced callback without
  // recreating the debounced function on every render.
  const queryRef = useRef(query);
  queryRef.current = query;
  const urlRef = useRef(url);
  urlRef.current = url;
  const onQueryRef = useRef(onQuery);
  onQueryRef.current = onQuery;

  const doQuery = useMemo(
    () =>
      debounce((cb: (...args: [Error] | [null, TData]) => void) => {
        return api
          .requestPromise(urlRef.current, {
            query:
              typeof onQueryRef.current === 'function'
                ? onQueryRef.current(queryRef.current)
                : {query: queryRef.current},
          })
          .then(
            (data: TData) => cb(null, data),
            (err: Error) => cb(err)
          );
      }, 250),
    [api]
  );

  const handleLoadOptions = (): Promise<any> =>
    new Promise<TData>((resolve, reject) => {
      doQuery((...errorOrData) => {
        if (errorOrData[0]) {
          reject(errorOrData[0]);
        } else {
          resolve(errorOrData[1]);
        }
      });
    }).then(
      resp => {
        return typeof onResults === 'function' ? onResults(resp) : resp;
      },
      (err: RequestError) => {
        addErrorMessage(t('There was a problem with the request.'));
        handleXhrErrorResponse('SelectAsync failed', err);
        // eslint-disable-next-line no-console
        console.error(err);
      }
    );

  const handleInputChange = (newQuery: any) => {
    setQuery(newQuery);
  };

  return (
    <Select
      // The key is used as a way to force a reload of the options:
      // https://github.com/JedWatson/react-select/issues/1879#issuecomment-316871520
      key={String(value)}
      ref={forwardedRef}
      value={value}
      placeholder={placeholder}
      defaultOptions={defaultOptions}
      loadOptions={handleLoadOptions}
      onInputChange={handleInputChange}
      async
      cache={cache.current}
      {...props}
    />
  );
}

export const SelectAsync = forwardRef((p: any, ref: any) => {
  return <SelectAsyncControl {...p} forwardedRef={ref} />;
});
