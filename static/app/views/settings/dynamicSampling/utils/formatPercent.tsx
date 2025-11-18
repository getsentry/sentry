import {formatFloat} from 'sentry/utils/number/formatFloat';

interface Options {
  addSymbol?: boolean;
}

export function formatPercent(value: number, {addSymbol}: Options = {}) {
  // Round to 2 decimal places before truncation to prevent values like 89.9999 from displaying as 89.99.
  const percentValue = Math.round(value * 100 * 100) / 100;
  const formatedNumber = formatFloat(percentValue, 2).toString();
  return addSymbol ? `${formatedNumber}%` : formatedNumber;
}
