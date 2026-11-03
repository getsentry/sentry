import {createFilter as createReactSelectFilter} from './reactSelectWrapper';
import type {SelectValue} from './types';

export function createFilter<
  TValue = unknown,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(config?: {
  stringify: (option: TOption) => string;
}): (option: TOption, input: string) => boolean {
  const filter = createReactSelectFilter({
    stringify: ({data}: {data: TOption}) =>
      config?.stringify(data) ??
      data.textValue ??
      `${typeof data.label === 'string' || typeof data.label === 'number' ? data.label : ''} ${data.value}`,
  });
  return (option, input) =>
    filter(
      {
        data: option,
        label: typeof option.label === 'string' ? option.label : '',
        value: String(option.value),
      },
      input
    );
}
