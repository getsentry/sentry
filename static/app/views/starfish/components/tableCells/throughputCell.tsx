import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {ComparisonLabel} from 'sentry/views/starfish/components/samplesTable/common';

type Props = {
  delta?: number;
  throughputPerSecond?: number;
};

export default function ThroughputCell({throughputPerSecond, delta}: Props) {
  const throughput = throughputPerSecond ? throughputPerSecond.toFixed(2) : '--';
  return (
    <Container>
      <span>{`${formatAbbreviatedNumber(throughput)}/${t('s')}`}</span>
      {delta ? (
        // Don't highlight throughput red or green, since throughput delta isn't good or bad
        <ComparisonLabel value={0}>
          {delta > 0 ? '+' : ''}
          {formatPercentage(delta)}
        </ComparisonLabel>
      ) : null}
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: ${space(1)};
`;
