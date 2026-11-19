import type {SelectValue} from './types';

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('æ', 'ae')
    .replaceAll('œ', 'oe')
    .replaceAll('ø', 'o')
    .replaceAll('ł', 'l');
}

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
    return normalize(text).includes(normalize(input));
  };
}
