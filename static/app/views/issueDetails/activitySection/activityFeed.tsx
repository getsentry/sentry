import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

export function ActivityFeed({children}: {children: React.ReactNode}) {
  return (
    <FeedContainer gap="md" containerType="inline-size" data-test-id="activity-timeline">
      {children}
    </FeedContainer>
  );
}

const FeedContainer = styled(Stack)`
  container-name: activity-list;
`;
