import {formatAbbreviatedNumberWithDynamicPrecision} from 'sentry/utils/formatters';

export function formalLLMCosts(cost: string | number) {
  return `$${formatAbbreviatedNumberWithDynamicPrecision(cost)}`;
}
