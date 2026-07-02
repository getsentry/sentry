import {ExternalLink} from '@sentry/scraps/link';

import {IconPullRequest} from 'sentry/icons';
import {GroupActivityType, type GroupActivity} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';

import {InlineChip} from './inlineChip';

function formatPullRequestId(id: number | string) {
  const value = String(id);
  return value.startsWith('#') ? value : `#${value}`;
}

export function PullRequestChip({pullRequest}: {pullRequest: PullRequest}) {
  const displayId = formatPullRequestId(pullRequest.id);

  if (!pullRequest.externalUrl) {
    return (
      <InlineChip>
        <IconPullRequest size="xs" />
        {displayId}
      </InlineChip>
    );
  }

  return (
    <ExternalLink href={pullRequest.externalUrl}>
      <InlineChip>
        <IconPullRequest size="xs" />
        {displayId}
      </InlineChip>
    </ExternalLink>
  );
}

export function SeerPullRequestChip({
  pullRequest,
}: {
  pullRequest: NonNullable<
    Extract<
      GroupActivity,
      {type: GroupActivityType.SEER_PR_CREATED}
    >['data']['pull_requests']
  >[number];
}) {
  return (
    <ExternalLink href={pullRequest.pull_request.pr_url}>
      <InlineChip>
        <IconPullRequest size="xs" />
        {formatPullRequestId(pullRequest.pull_request.pr_number)}
      </InlineChip>
    </ExternalLink>
  );
}
