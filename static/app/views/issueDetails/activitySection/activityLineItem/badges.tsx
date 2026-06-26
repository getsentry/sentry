import styled from '@emotion/styled';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {ExternalLink} from '@sentry/scraps/link';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {IconPullRequest, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {GroupActivityType, PriorityLevel, type GroupActivity} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';

interface InlineChipProps {
  children: React.ReactNode;
  compactLeading?: boolean;
  constrain?: boolean;
}

function formatPullRequestId(id: number | string) {
  const value = String(id);
  return value.startsWith('#') ? value : `#${value}`;
}

function InlineChip({children, compactLeading, constrain}: InlineChipProps) {
  return (
    <ChipFrame $compactLeading={compactLeading} $constrain={constrain}>
      {children}
    </ChipFrame>
  );
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

export function ActivityRelease({
  organization,
  project,
  version,
}: {
  organization: Organization;
  project: Project;
  version: string;
}) {
  return (
    <VersionHoverCard
      organization={organization}
      projectSlug={project.slug}
      releaseVersion={version}
      containerDisplayMode="inline-block"
    >
      <InlineChip constrain>
        <IconReleases size="xs" />
        <Version version={version} projectId={project.id} truncate />
      </InlineChip>
    </VersionHoverCard>
  );
}

function isTeam(value: Team | User): value is Team {
  return 'slug' in value;
}

export function AssigneePill({assignee}: {assignee: string | Team | User}) {
  if (typeof assignee === 'string') {
    return <InlineChip>{assignee}</InlineChip>;
  }

  if (isTeam(assignee)) {
    return (
      <InlineChip compactLeading>
        <TeamAvatar team={assignee} size={16} hasTooltip={false} />#{assignee.slug}
      </InlineChip>
    );
  }

  return (
    <InlineChip compactLeading>
      <UserAvatar user={assignee} size={16} />
      {assignee.name || assignee.email || assignee.username}
    </InlineChip>
  );
}

function getPriorityBars(priority: PriorityLevel | string): 1 | 2 | 3 {
  switch (priority) {
    case PriorityLevel.HIGH:
      return 3;
    case PriorityLevel.MEDIUM:
      return 2;
    case PriorityLevel.LOW:
    default:
      return 1;
  }
}

function getPriorityLabel(priority: PriorityLevel | string) {
  switch (priority) {
    case PriorityLevel.HIGH:
      return t('High');
    case PriorityLevel.MEDIUM:
      return t('Med');
    case PriorityLevel.LOW:
      return t('Low');
    default:
      return priority;
  }
}

export function ActivityPriorityChip({priority}: {priority: PriorityLevel | string}) {
  return (
    <InlineChip compactLeading>
      <IconCellSignal size="xs" bars={getPriorityBars(priority)} />
      {getPriorityLabel(priority)}
    </InlineChip>
  );
}

const ChipFrame = styled('span')<{
  $compactLeading?: boolean;
  $constrain?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  min-height: 20px;
  max-width: ${p => (p.$constrain ? '100%' : undefined)};
  min-width: ${p => (p.$constrain ? 0 : undefined)};
  padding: 0 ${p => p.theme.space.sm};
  padding-left: ${p => (p.$compactLeading ? p.theme.space.xs : undefined)};
  border-radius: ${p => p.theme.radius.xs};
  background: ${p => p.theme.colors.gray100};
  color: ${p => p.theme.tokens.content.secondary};
  vertical-align: middle;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
  }

  a {
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    color: inherit;
  }
`;
