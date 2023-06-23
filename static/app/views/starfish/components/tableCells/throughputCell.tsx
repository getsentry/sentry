import {t} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';

  return (
    <NumberContainer>
      {formatAbbreviatedNumber(throughput)}/${t('s')}
    </NumberContainer>
  );
}
