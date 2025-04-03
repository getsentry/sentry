import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function TestsPage() {
  return (
    <LayoutGap>
      <p>Test Analytics</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
