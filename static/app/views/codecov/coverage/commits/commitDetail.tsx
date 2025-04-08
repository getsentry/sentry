import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {CommitDetailSummary} from 'sentry/views/codecov/coverage/commits/commitDetailSummary';

export default function CommitDetailPage() {
  return (
    <LayoutGap>
      <CommitDetailSummary />
      <p>Commit Detail Page</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
