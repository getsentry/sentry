import {createFilter as createReactSelectFilter} from './reactSelectWrapper';
import type {SelectValue} from './types';

export function createFilter<
  Option extends SelectValue<any> = SelectValue<any>,
>(config?: {
  stringify: (option: Option) => string;
}): (option: Option, input: string) => boolean {
  const filter = createReactSelectFilter({
    stringify: ({data}: {data: Option}) =>
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
