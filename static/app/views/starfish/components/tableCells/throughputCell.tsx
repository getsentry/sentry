import {t} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {ComparisonLabel} from 'sentry/views/starfish/components/samplesTable/common';

type Props = {
  delta?: number;
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond, delta}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';
  return (
    <NumberContainer>
      <span>{`${formatAbbreviatedNumber(throughput)}/${t('s')}`}</span>
      {delta ? (
        // Don't highlight throughput red or green, since throughput delta isn't good or bad
        <ComparisonLabel value={0}>
          {delta > 0 ? '+' : ''}
          {formatPercentage(delta)}
        </ComparisonLabel>
      ) : null}
    </NumberContainer>
  );
}
