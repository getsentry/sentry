import {Stack} from 'sentry/components/core/layout/stack';
import type {PullRequestDetailsSuccessResponse} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

import PRFilesList from './prFilesList';

interface PullRequestDetailsMainContentProps {
  pullRequest: PullRequestDetailsSuccessResponse;
}

export function PullRequestDetailsMainContent({
  pullRequest,
}: PullRequestDetailsMainContentProps) {
  return (
    <Stack gap="md">
      <PRFilesList files={pullRequest.files} commentsData={null} />
    </Stack>
  );
}
