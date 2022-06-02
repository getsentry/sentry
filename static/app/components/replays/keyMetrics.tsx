import {Fragment} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

/**
 * Very similar to app/components/keyValueTable.tsx
 * TODO(replay): move into app/components
 */

type Props = {
  keyName: React.ReactNode;
  value: React.ReactNode;
};

export const KeyMetrics = styled('dl')`
  margin: 0; /* Reset default dl styles */

  display: grid;
  grid-template-rows: auto auto;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: ${space(0.5)} ${space(2)};

  text-align: right;
`;

export const KeyMetricData = ({keyName, value}: Props) => {
  return (
    <Fragment>
      <Key>{keyName}</Key>
      <Value>{value}</Value>
    </Fragment>
  );
};

const Key = styled('dt')`
  color: ${p => p.theme.subText};
  font-size: 14px;
  font-weight: bold;
`;

const Value = styled('dt')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
`;
