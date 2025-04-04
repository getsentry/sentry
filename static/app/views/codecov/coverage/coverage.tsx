import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CoveragePage() {
  return (
    <LayoutGap>
      <p>Coverage Analytics</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
