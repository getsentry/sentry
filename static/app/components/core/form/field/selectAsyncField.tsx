import {useState} from 'react';
import type {InputActionMeta} from 'react-select/src/types';
import {useQuery, type UseQueryOptions} from '@tanstack/react-query';
import type {DistributedOmit} from 'type-fest';

import type {SelectValue} from 'sentry/types/core';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import {type BaseFieldProps} from './baseField';
import {SelectField, type SelectFieldProps} from './selectField';

type SelectAsyncFieldProps<TData, TValue> = BaseFieldProps<HTMLInputElement> &
  DistributedOmit<
    SelectFieldProps<TValue>,
    'options' | 'isLoading' | 'onInputChange' | 'id'
  > & {
    /**
     * Called when selection changes with the full data object
     */
    onChange: (value: TValue) => void;

    /**
     * Query configuration - function receives debounced input, returns query options.
     * Use `select` to transform API data to options with full object as value.
     *
     * @example
     * queryOptions={(debouncedInput) => {
     *   const baseOptions = apiOptions.as<MyType[]>()(path, {
     *     path: {...},
     *     query: {query: debouncedInput},
     *     staleTime: 30_000,
     *   });
     *   return {
     *     ...baseOptions,
     *     select: raw => baseOptions.select(raw).map(item => ({
     *       value: item,
     *       label: item.name,
     *       details: item.description,
     *     })),
     *   };
     * }}
     */
    queryOptions: (
      debouncedInput: string
    ) => UseQueryOptions<TData, Error, Array<SelectValue<TValue>>, any>;

    /**
     * Options to display immediately while the initial query is loading.
     * Useful to prevent a flash of empty placeholder when the select already
     * has a value that needs a matching option to render its label.
     */
    defaultOptions?: Array<SelectValue<TValue>>;
  };

const DEBOUNCE_MS = 250;

export function SelectAsyncField<TData, TValue = string>({
  queryOptions,
  defaultOptions,
  multiple,
  onChange,
  value,
  ...props
}: SelectAsyncFieldProps<TData, TValue>) {
  // Internal state for search input
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  // Fetch options using the provided queryOptions
  const {data: fetchedOptions, isPending} = useQuery(queryOptions(debouncedInput));

  // Use defaultOptions while the initial query is loading to avoid a flash of empty placeholder
  const options = fetchedOptions ?? defaultOptions ?? [];

  return (
    <SelectField
      {...props}
      multiple={multiple}
      onChange={onChange}
      value={value}
      options={options}
      isLoading={isPending || inputValue !== debouncedInput}
      onInputChange={(newInputValue: string, actionMeta: InputActionMeta) => {
        if (actionMeta.action === 'input-change') {
          setInputValue(newInputValue);
        }
      }}
    />
  );
}
