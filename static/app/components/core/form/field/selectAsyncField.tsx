import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

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
  Omit<
    SelectFieldProps<TData>,
    'options' | 'isLoading' | 'onInputChange' | 'multiple' | 'value' | 'onChange'
  > & {
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

    /**
     * Current value - the full data object or null
     */
    value: TData | null;
  };

export type {SelectAsyncFieldProps};

const DEBOUNCE_MS = 250;

export function SelectAsyncField<TData>({
  queryOptions,
  ...props
}: SelectAsyncFieldProps<TData>) {
  // Internal state for search input
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  // Fetch options using the provided queryOptions
  const {data: options = [], isPending} = useQuery(queryOptions(debouncedInput));

  return (
    <SelectField
      {...props}
      options={options}
      isLoading={isPending}
      onInputChange={setInputValue}
    />
  );
}
