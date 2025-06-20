import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function ReplayAssertionsPage() {
  return (
    <LayoutGap>
      <p>Replay Assertions</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
