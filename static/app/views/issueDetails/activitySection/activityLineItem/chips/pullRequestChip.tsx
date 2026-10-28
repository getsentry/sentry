import {IconPullRequest} from '@sentry/icons/pullRequest';

import {ExternalLink} from '@sentry/scraps/link';

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
      <InlineChip interactive>
        <IconPullRequest size="xs" />
        {displayId}
      </InlineChip>
    </ExternalLink>
  );
}

export function SeerPullRequestChip({
  pullRequest,
}: {
  pullRequest: {pull_request: {pr_number: number; pr_url: string}};
}) {
  return (
    <ExternalLink href={pullRequest.pull_request.pr_url}>
      <InlineChip interactive>
        <IconPullRequest size="xs" />
        {formatPullRequestId(pullRequest.pull_request.pr_number)}
      </InlineChip>
    </ExternalLink>
  );
}
