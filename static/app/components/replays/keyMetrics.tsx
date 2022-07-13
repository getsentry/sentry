import styled from '@emotion/styled';

import space from 'sentry/styles/space';

/**
 * Very similar to app/components/keyValueTable.tsx
 * TODO(replay): move into app/components
 */

type Props = {
  children?: React.ReactChild;
};

export const KeyMetrics = styled('div')`
  display: flex;
  gap: ${space(3)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const KeyMetricData = ({children}: Props) => {
  return <Value>{children}</Value>;
};

const Value = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
