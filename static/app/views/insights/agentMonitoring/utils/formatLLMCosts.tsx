import {formatAbbreviatedNumberWithDynamicPrecision} from 'sentry/utils/formatters';

export function formatLLMCosts(cost: string | number) {
  if (Number(cost) < 0.01) {
    return `<$${(0.01).toLocaleString()}`;
  }
  return `$${formatAbbreviatedNumberWithDynamicPrecision(cost)}`;
}
