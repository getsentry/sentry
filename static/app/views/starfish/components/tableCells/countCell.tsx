import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import {ComparisonLabel} from 'sentry/views/starfish/components/samplesTable/common';

type Props = {
  count: number;
  delta?: number;
};

export default function CountCell({count, delta}: Props) {
  return (
    <Container>
      {count}
      {delta ? (
        <ComparisonLabel value={delta}>
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
  justify-content: flex-end;
  text-align: right;
  gap: ${space(1)};
`;
