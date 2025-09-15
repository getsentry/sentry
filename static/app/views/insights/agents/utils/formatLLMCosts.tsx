import {formatDollars} from 'sentry/utils/formatters';

export function formatLLMCosts(cost: string | number | null) {
  if (cost === null) {
    return '\u2014';
  }
  let number = Number(cost);
  // TODO: remove this hotfix for bug on BE that results in costs sometimes being multiplied by 1000000
  if (number > 10000) {
    number = number / 1_000_000;
  }
  if (number < 0.01) {
    return `<$${(0.01).toLocaleString()}`;
  }
  return formatDollars(number);
}
