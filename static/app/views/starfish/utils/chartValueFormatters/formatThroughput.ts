import {t} from 'sentry/locale';

const formatThroughput = (throughputPerSecond: number = -1) => {
  const throughput = throughputPerSecond === -1 ? '--' : throughputPerSecond.toFixed(2);
  return `${throughput} / ${t('s')}`;
};

export default formatThroughput;
