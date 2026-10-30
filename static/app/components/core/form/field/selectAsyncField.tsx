import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery, type UseQueryOptions} from '@tanstack/react-query';
import type {DistributedOmit} from 'type-fest';

import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import type {SelectValue} from '@sentry/scraps/select';

import {type BaseFieldProps} from './baseField';
import {SelectField, type SelectFieldProps} from './selectField';

type SelectAsyncFieldProps<
  TData,
  TValue,
  TOption extends SelectValue<TValue>,
> = BaseFieldProps<HTMLInputElement> & {field: AnyFieldApi} & DistributedOmit<
    SelectFieldProps<TValue, TOption>,
    'options' | 'isLoading' | 'onInputChange'
  > & {
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
    ) => UseQueryOptions<TData, Error, ReadonlyArray<TOption & SelectValue<TValue>>, any>;
  };

const DEBOUNCE_MS = 250;

export function SelectAsyncField<
  TData,
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>({queryOptions, ...props}: SelectAsyncFieldProps<TData, TValue, TOption>) {
  // Internal state for search input
  const [inputValue, setInputValue] = useState('');
  const [debouncedInput] = useDebouncedValue(inputValue, {wait: DEBOUNCE_MS});

  // Fetch options using the provided queryOptions
  const {data: options = [], isPending} = useQuery(queryOptions(debouncedInput));

  return (
    <SelectField
      {...props}
      options={options}
      isLoading={isPending || inputValue !== debouncedInput}
      onInputChange={(input, reason) => {
        if (reason === 'input') {
          setInputValue(input);
        }
      }}
    />
  );
}

type SelectAsyncLooseField = <
  TData,
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(
  props: Omit<SelectAsyncFieldProps<TData, TValue, TOption>, 'field'>
) => React.ReactNode;
export const SelectAsyncLooseField = fieldComponent.loose(
  SelectAsyncField,
  'field'
) as SelectAsyncLooseField;
