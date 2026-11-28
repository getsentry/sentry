import {getSearchScore} from '../fzf';

import type {SelectValue} from './types';

export function createFilter<
  TValue = unknown,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(config?: {
  stringify: (option: TOption) => string;
}): (option: TOption, input: string) => boolean {
  return (option, input) => {
    const text =
      config?.stringify(option) ??
      option.textValue ??
      `${typeof option.label === 'string' || typeof option.label === 'number' ? option.label : ''} ${option.value}`;
    return getSearchScore(text, input.trim()) > 0;
  };
}
