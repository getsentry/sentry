import {formatAbbreviatedNumberWithDynamicPrecision} from 'sentry/utils/formatters';

export function formatLLMCosts(cost: string | number) {
  return `$${formatAbbreviatedNumberWithDynamicPrecision(cost)}`;
}
