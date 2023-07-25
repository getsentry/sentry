import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fieldRenderers';

const formatThroughput = (rate?: number, unit?: RateUnits) => {
  return `${rate ? rate.toFixed(2) : '--'}${
    RATE_UNIT_LABELS[unit ?? RateUnits.PER_SECOND]
  }`;
};

export default formatThroughput;
