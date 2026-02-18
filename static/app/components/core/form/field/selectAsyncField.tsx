import {useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {SelectValue} from 'sentry/types/core';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

function SelectInput({
  selectProps,
  ...props
}: React.ComponentProps<typeof components.Input> & {
  selectProps: {'aria-invalid': boolean};
}) {
  return <components.Input {...props} aria-invalid={selectProps['aria-invalid']} />;
}

function SelectIndicatorsContainer({
  children,
}: React.ComponentProps<typeof components.IndicatorsContainer>) {
  const indicator = useFieldStateIndicator();
  return (
    <Flex padding="0 sm" gap="sm" align="center">
      {indicator}
      {children}
    </Flex>
  );
}

/**
 * Option type for SelectAsync where value is the full data object
 */
export type SelectAsyncOption<TData> = {
  label: React.ReactNode;
  value: TData;
  details?: React.ReactNode;
};

type BaseSelectAsyncFieldProps<TData> = BaseFieldProps &
  Omit<
    React.ComponentProps<typeof Select>,
    | 'value'
    | 'onChange'
    | 'onBlur'
    | 'disabled'
    | 'options'
    | 'isLoading'
    | 'onInputChange'
  > & {
    /**
     * Called when selection changes with the full data object
     */
    onChange: (value: TData | null) => void;

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

    /**
     * Disabled state - boolean or string (string shows as tooltip)
     */
    disabled?: boolean | string;
  };

export type SelectAsyncFieldProps<TData> = BaseSelectAsyncFieldProps<TData>;

const DEBOUNCE_MS = 250;

export function SelectAsyncField<TData>({
  queryOptions,
  onChange,
  disabled,
  value,
  ...props
}: SelectAsyncFieldProps<TData>) {
  const autoSaveContext = useAutoSaveContext();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  // Internal state for search input
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  // Fetch options using the provided queryOptions
  const {data: options = [], isPending} = useQuery(queryOptions(debouncedInput));

  // Find the currently selected option from the options list
  // This is needed to display the selected value correctly
  const selectedOption = useMemo(() => {
    if (value === null) {
      return null;
    }
    // Try to find the option in the current options list
    const found = options.find(opt => opt.value === value);
    if (found) {
      return found;
    }
    // If not found (e.g., different search results), create a placeholder option
    // This ensures the select displays something while the actual option might not be in view
    return {value, label: String(value), details: undefined} as SelectAsyncOption<TData>;
  }, [value, options]);

  // Track whether the menu is open for auto-save behavior
  const isMenuOpenRef = useRef(false);

  return (
    <BaseField>
      {({id, ...fieldProps}) => {
        const select = (
          <Select
            {...fieldProps}
            {...props}
            inputId={id}
            disabled={isDisabled}
            options={options}
            value={selectedOption}
            isLoading={isPending}
            onInputChange={(newValue: string) => {
              setInputValue(newValue);
            }}
            components={{
              ...props.components,
              Input: SelectInput,
              IndicatorsContainer: SelectIndicatorsContainer,
            }}
            onMenuOpen={() => {
              isMenuOpenRef.current = true;
              props.onMenuOpen?.();
            }}
            onMenuClose={() => {
              isMenuOpenRef.current = false;
              props.onMenuClose?.();
            }}
            onChange={(option: SelectValue<TData> | null) => {
              // Extract the full object from the selected option
              const selectedValue = option?.value ?? null;
              onChange(selectedValue);
            }}
          />
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{select}</Tooltip>;
        }

        return select;
      }}
    </BaseField>
  );
}
