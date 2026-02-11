import {Stack} from '@sentry/scraps/layout';

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
      <PRFilesList files={pullRequest.files} />
    </Stack>
  );
}
