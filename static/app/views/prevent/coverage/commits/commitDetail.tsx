import styled from '@emotion/styled';

import {CommitDetailSummary} from 'sentry/views/prevent/coverage/commits/commitDetailSummary';

export default function CommitDetailPage() {
  return (
    <ContentContainer>
      <CommitDetailSummary />
      <p>Commit Detail Page hello</p>
    </ContentContainer>
  );
}

const ContentContainer = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
`;
