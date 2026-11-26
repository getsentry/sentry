import type {ReactNode} from 'react';
import {useState} from 'react';

import type {SelectValue} from './types';

export const CREATE_KEY = 'create';

export type OptionRow<T> = {key: string; option: T};
type OptionEntry<T> = OptionRow<T> | {rows: Array<OptionRow<T>>; label?: ReactNode};

type Options<T> = ReadonlyArray<T | {options: readonly T[]; label?: ReactNode}>;

function matchesValue<TValue>(
  optionValue: TValue,
  value: TValue | null,
  isValueEqual?: (a: TValue, b: TValue) => boolean
) {
  return value != null && optionValue != null && isValueEqual
    ? isValueEqual(optionValue, value)
    : optionValue === value;
}

function indexOptions<TValue, TOption extends SelectValue<TValue>>(
  options: Options<TOption>,
  previousRows: ReadonlyArray<OptionRow<TOption>>,
  nextId: number,
  isValueEqual?: (a: TValue, b: TValue) => boolean
) {
  const keysByValue = new Map<TValue, string[]>();
  for (const {key, option} of previousRows) {
    const keys = keysByValue.get(option.value) ?? [];
    keys.push(key);
    keysByValue.set(option.value, keys);
  }
  const used = new Set<string>();
  const rows: Array<OptionRow<TOption>> = [];

  function indexOption(option: TOption) {
    const previousKey =
      keysByValue.get(option.value)?.find(key => !used.has(key)) ??
      (isValueEqual &&
        option.value != null &&
        previousRows.find(
          row =>
            !used.has(row.key) &&
            matchesValue(row.option.value, option.value, isValueEqual)
        )?.key);
    const key = previousKey || `option-${nextId++}`;
    used.add(key);
    const row = {key, option};
    rows.push(row);
    return row;
  }

  const entries = options.map<OptionEntry<TOption>>(entry =>
    'options' in entry
      ? {label: entry.label, rows: entry.options.map(indexOption)}
      : indexOption(entry)
  );
  return {options, entries, rows, nextId};
}

export function useOptionIndex<TValue, TOption extends SelectValue<TValue>>(
  options: Options<TOption>,
  {
    creatable,
    isLoading,
    isValueEqual,
    query,
    values,
  }: {
    query: string;
    values: ReadonlyArray<TValue | null>;
    creatable?: boolean;
    isLoading?: boolean;
    isValueEqual?: (a: TValue, b: TValue) => boolean;
  }
) {
  const [previousIndex, setIndex] = useState(() =>
    indexOptions(options, [], 0, isValueEqual)
  );
  const index =
    options === previousIndex.options
      ? previousIndex
      : indexOptions(options, previousIndex.rows, previousIndex.nextId, isValueEqual);
  if (index !== previousIndex) {
    setIndex(index);
  }

  const findRow = (value: TValue | null) =>
    index.rows.find(row => matchesValue(row.option.value, value, isValueEqual));

  const selectedRows = values.flatMap<{
    option: SelectValue<TValue> | TOption;
    key?: string;
  }>(value => {
    const existing = findRow(value);
    if (existing) {
      return [existing];
    }
    if (creatable && value != null) {
      return [{option: {value, label: String(value)}, key: undefined}];
    }
    return [];
  });

  const normalizedQuery = query.toLowerCase();
  const canCreate =
    creatable &&
    query !== '' &&
    !isLoading &&
    ![...index.rows, ...selectedRows].some(({option}) =>
      [option.label, option.value].some(
        value => typeof value === 'string' && value.toLowerCase() === normalizedQuery
      )
    );

  return {entries: index.entries, rows: index.rows, selectedRows, canCreate};
}
