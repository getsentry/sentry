import type {ReactNode} from 'react';
import {useState} from 'react';

import type {SelectValue} from './types';

export type OptionRow<T> = {key: string; option: T};
type OptionEntry<T> = OptionRow<T> | {rows: Array<OptionRow<T>>; label?: ReactNode};

type Options<T> = ReadonlyArray<T | {options: readonly T[]; label?: ReactNode}>;

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
            row.option.value != null &&
            isValueEqual(row.option.value, option.value)
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
  isValueEqual?: (a: TValue, b: TValue) => boolean
) {
  const [index, setIndex] = useState(() => indexOptions(options, [], 0, isValueEqual));
  if (options !== index.options) {
    const next = indexOptions(options, index.rows, index.nextId, isValueEqual);
    setIndex(next);
    return next;
  }
  return index;
}
