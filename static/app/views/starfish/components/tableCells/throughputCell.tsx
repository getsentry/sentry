import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';
  return <span>{`${formatAbbreviatedNumber(throughput)}/${t('s')}`}</span>;
}
