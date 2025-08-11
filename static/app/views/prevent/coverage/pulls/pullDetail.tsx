import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function PullDetailPage() {
  return (
    <LayoutGap>
      <p>Pull Detail Page</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
