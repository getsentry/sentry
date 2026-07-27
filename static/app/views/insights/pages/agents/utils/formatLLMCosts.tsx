/* eslint-disable unicorn/filename-case */
import {formatDollars} from 'sentry/utils/formatters';

export function formatLLMCosts(cost: string | number | null) {
  if (cost === null) {
    return '—';
  }
  const number = Number(cost);

  // Treat an exact 0 the same as null. Summed aggregations report 0 when every
  // value was null, and a genuine 0 cost is very unlikely (most often an
  // instrumentation bug), so render "no cost recorded" rather than $0.
  if (number === 0) {
    return '—';
  }
  // Negative costs signal bad token reporting and render as a precise amount.
  if (number < 0) {
    return formatDollars(number);
  }
  if (number < 0.01) {
    return `<$${(0.01).toLocaleString()}`;
  }
  return formatDollars(number);
}
