import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CommitDetailPage() {
  return (
    <LayoutGap>
      <p>Commit Detail Page</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
