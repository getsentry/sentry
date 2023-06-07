import {t} from 'sentry/locale';

type Props = {
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';
  return <span>{`${throughput}/${t('sec')}`}</span>;
}
