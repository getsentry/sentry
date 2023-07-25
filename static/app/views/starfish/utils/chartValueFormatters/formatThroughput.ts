import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fieldRenderers';

const formatThroughput = (rate: number = -1, unit: RateUnits) => {
  return `${rate === -1 ? '--' : rate.toFixed(2)}${
    RATE_UNIT_LABELS[unit ?? RateUnits.PER_SECOND]
  }`;
};

export default formatThroughput;
