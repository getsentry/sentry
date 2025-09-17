import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CommitHistoryPage() {
  return (
    <LayoutGap>
      <p>Commit History Page</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
