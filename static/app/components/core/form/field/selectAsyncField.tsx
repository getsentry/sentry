import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {DistributedOmit} from 'type-fest';

import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import {type BaseFieldProps} from './baseField';
import {SelectField, type SelectFieldProps} from './selectField';

/**
 * Option type for SelectAsync where value is the full data object
 */
export type SelectAsyncOption<TData> = {
  label: React.ReactNode;
  value: TData;
  details?: React.ReactNode;
};

type SelectAsyncFieldProps<TData> = BaseFieldProps &
  DistributedOmit<SelectFieldProps<TData>, 'options' | 'isLoading' | 'onInputChange'> & {
    /**
     * Called when selection changes with the full data object
     */
    onChange: (value: TData) => void;

    /**
     * Query configuration - function receives debounced input, returns query options.
     * Use `select` to transform API data to options with full object as value.
     *
     * @example
     * queryOptions={(debouncedInput) => ({
     *   queryKey: [url, {query: {query: debouncedInput}}],
     *   queryFn: ({queryKey}) => api.requestPromise(queryKey[0], {query: queryKey[1]?.query}),
     *   select: (data) => data.map(item => ({
     *     value: item,  // Full object stored in form state
     *     label: item.name,
     *     details: item.description,
     *   })),
     *   staleTime: 30_000,
     * })}
     */
    queryOptions: (debouncedInput: string) => {
      queryFn: (context: {queryKey: ApiQueryKey}) => Promise<unknown>;
      queryKey: ApiQueryKey;
      select: (data: unknown) => Array<SelectAsyncOption<TData>>;
      staleTime?: number;
    };
  };

const DEBOUNCE_MS = 250;

export function SelectAsyncField<TValue = string>({
  queryOptions,
  multiple,
  onChange,
  value,
  ...props
}: SelectAsyncFieldProps<TValue>) {
  // Internal state for search input
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  // Fetch options using the provided queryOptions
  const {data: options = [], isPending} = useQuery(queryOptions(debouncedInput));

  return (
    <SelectField
      {...props}
      multiple={multiple}
      onChange={onChange}
      value={value}
      options={options}
      isLoading={isPending}
      onInputChange={setInputValue}
    />
  );
}
