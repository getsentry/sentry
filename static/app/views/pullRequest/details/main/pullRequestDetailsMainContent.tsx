import {Stack} from 'sentry/components/core/layout/stack';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import type {PullRequestDetailsSuccessResponse} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

interface PullRequestDetailsMainContentProps {
  pullRequest: PullRequestDetailsSuccessResponse;
}

export function PullRequestDetailsMainContent({
  pullRequest,
}: PullRequestDetailsMainContentProps) {
  return (
    <Stack gap="md">
      <Heading as="h2">
        {t('Files Changed')} ({pullRequest.files.length})
      </Heading>

      <Text>Coming soon...</Text>
    </Stack>
  );
}
