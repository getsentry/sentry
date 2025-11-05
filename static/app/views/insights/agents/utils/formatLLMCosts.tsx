import {formatDollars} from 'sentry/utils/formatters';

export function formatLLMCosts(cost: string | number | null) {
  if (cost === null) {
    return '\u2014';
  }
  const number = Number(cost);

  if (number < 0.01) {
    return `<$${(0.01).toLocaleString()}`;
  }
  return formatDollars(number);
}
