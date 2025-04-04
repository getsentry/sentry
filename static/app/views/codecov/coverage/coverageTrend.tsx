import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CoverageTrendPage() {
  return (
    <LayoutGap>
      <p>Coverage Trend</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
