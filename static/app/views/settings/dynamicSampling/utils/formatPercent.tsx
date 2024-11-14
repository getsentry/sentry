import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';

interface Options {
  addSymbol?: boolean;
}

export function formatPercent(value: number, {addSymbol}: Options = {}) {
  const formatedNumber = formatNumberWithDynamicDecimalPoints(value * 100, 2);
  return addSymbol ? `${formatedNumber}%` : formatedNumber;
}
