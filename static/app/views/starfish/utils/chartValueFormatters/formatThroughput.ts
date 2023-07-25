import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

const formatThroughput = (rate?: number, unit?: RateUnits) => {
  return `${rate ? formatAbbreviatedNumber(rate) : '--'}${
    RATE_UNIT_LABELS[unit ?? RateUnits.PER_SECOND]
  }`;
};

export default formatThroughput;
