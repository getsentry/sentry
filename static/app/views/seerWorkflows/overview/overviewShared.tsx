import {Fragment} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Badge, Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCheckmark,
  IconClock,
  IconClose,
  IconGraph,
  IconMerge,
  IconOpen,
  IconPullRequest,
  IconSeer,
  IconThumb,
  IconUser,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {
  PullRequestChecksStatus,
  PullRequestReviewStatus,
} from 'sentry/types/integrations';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {HoverOverlayGroupProvider} from 'sentry/utils/useHoverOverlay';
import {useOrganization} from 'sentry/utils/useOrganization';

import {OpenSeerButton} from './openSeerButton';
import {getProcessingLabel} from './overviewActions';
import {ActionButtonBar, ButtonSpinner, OverviewCardAction} from './overviewCardAction';
import {OverviewIssueAssignee} from './overviewIssueAssignee';
import {
  OverviewIssuePriority,
  type OverviewIssuePriorityGroup,
} from './overviewIssuePriority';
import {periodWindowLabel} from './periods';
import {
  GroupHeader,
  STATUS_GROUP_META,
  StatusGroup,
  type StatusGroupKey,
  StatusGroupTooltip,
} from './statusGroups';
import type {
  AutofixStateKey,
  OverviewCodeChangeFile,
  OverviewPullRequest,
  OverviewRun,
  ProjectConfig,
} from './types';

// The endpoint orders links oldest-first and only enriches open/draft PRs, so
// the newest actionable link is the one carrying badges and files.
export function selectReviewPullRequest(
  pullRequests: OverviewPullRequest[]
): OverviewPullRequest | undefined {
  const actionable = pullRequests.filter(
    pr => pr.status === 'open' || pr.status === 'draft'
  );
  return actionable.at(-1) ?? pullRequests.at(-1);
}

const REVIEW_PR_META = {
  Icon: IconPullRequest,
  label: t('Review PR'),
  description: t('Autofix opened a pull request. Review and merge it.'),
};

interface PullRequestStatusTagMeta {
  icon: React.ReactNode;
  label: string;
  variant: TagProps['variant'];
}

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// Inherits the tag's variant color via currentColor, like the other status icons.
const ChecksSpinner = styled('span')`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  animation: ${spin} 0.6s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`;

const CHECKS_STATUS_TAGS = {
  failure: {
    icon: <IconClose />,
    label: t('Checks Failing'),
    variant: 'danger',
  },
  pending: {
    icon: <ChecksSpinner aria-hidden />,
    label: t('Checks Running'),
    variant: 'warning',
  },
  success: {
    icon: <IconCheckmark />,
    label: t('Checks Passing'),
    variant: 'success',
  },
} satisfies Record<PullRequestChecksStatus, PullRequestStatusTagMeta>;

const REVIEW_STATUS_TAGS = {
  approved: {
    icon: <IconThumb />,
    label: t('Approved'),
    variant: 'success',
  },
  changes_requested: {
    icon: <IconClose />,
    label: t('Changes Requested'),
    variant: 'warning',
  },
  review_required: null,
} satisfies Record<PullRequestReviewStatus, PullRequestStatusTagMeta | null>;

// The review + checks status tags for an enriched PR. Shared so the card (stacked
// under its action) and the table (in a badge column) render identical badges.
// Returns null when the PR has no enrichment yet.
export function ReviewPrStatusTags({pullRequest}: {pullRequest: OverviewPullRequest}) {
  const checksStatusTag = pullRequest.checksStatus
    ? CHECKS_STATUS_TAGS[pullRequest.checksStatus]
    : null;
  const reviewStatusTag = pullRequest.reviewStatus
    ? REVIEW_STATUS_TAGS[pullRequest.reviewStatus]
    : null;
  const failedChecks =
    pullRequest.checksStatus === 'failure' ? (pullRequest.failedCheckDetails ?? []) : [];

  if (!reviewStatusTag && !checksStatusTag) {
    return null;
  }

  return (
    <Fragment>
      {reviewStatusTag && (
        <Tag variant={reviewStatusTag.variant} icon={reviewStatusTag.icon}>
          {reviewStatusTag.label}
        </Tag>
      )}
      {checksStatusTag && (
        <HoverOverlayGroupProvider>
          <Tooltip
            disabled={failedChecks.length === 0}
            title={
              <Stack gap="xs" align="start">
                <Text size="sm" bold align="left">
                  {t('Failing checks:')}
                </Text>
                <Stack gap="2xs" align="start">
                  {failedChecks.map((check, index) => (
                    <Flex key={`${check.name}-${index}`} gap="xs" align="start">
                      <Text size="sm" variant="muted">
                        •
                      </Text>
                      <Text size="sm" align="left">
                        {check.url ? (
                          <ExternalLink href={check.url}>{check.name}</ExternalLink>
                        ) : (
                          check.name
                        )}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              </Stack>
            }
          >
            <Tag variant={checksStatusTag.variant} icon={checksStatusTag.icon}>
              {failedChecks.length > 0
                ? tn('%s Check Failing', '%s Checks Failing', failedChecks.length)
                : checksStatusTag.label}
            </Tag>
          </Tooltip>
        </HoverOverlayGroupProvider>
      )}
    </Fragment>
  );
}

// Aggregate a run's proposed code changes into a one-line summary. Counts distinct
// file paths and sums additions/deletions across every repo's patches.
export function summarizeCodeChanges(codeChanges: OverviewCodeChangeFile[]): {
  additions: number;
  deletions: number;
  fileCount: number;
} {
  const paths = new Set<string>();
  let additions = 0;
  let deletions = 0;
  for (const {patch} of codeChanges) {
    paths.add(patch.path);
    additions += patch.added;
    deletions += patch.removed;
  }
  return {fileCount: paths.size, additions, deletions};
}

// The "N files · +X −Y" badge for a run that reached code changes but has no PR
// yet. Sourced entirely from the status poll (no SCM fetch).
export function CodeChangesSummaryTag({
  codeChanges,
}: {
  codeChanges: OverviewCodeChangeFile[];
}) {
  const {fileCount, additions, deletions} = summarizeCodeChanges(codeChanges);
  if (fileCount === 0) {
    return null;
  }
  return (
    <Flex gap="sm" align="center">
      <Tag variant="muted">{tn('%s file', '%s files', fileCount)}</Tag>
      <Flex gap="xs" align="center">
        <Text size="sm" variant="success" tabular>
          {t('+%s', additions.toLocaleString())}
        </Text>
        <Text size="sm" variant="danger" tabular>
          {t('−%s', deletions.toLocaleString())}
        </Text>
      </Flex>
    </Flex>
  );
}

export function OverviewAction({
  sectionKey,
  run,
  reviewPullRequest,
  issueUrl,
  projectConfig,
  showReviewTags = true,
}: {
  issueUrl: string;
  projectConfig: ProjectConfig | undefined;
  reviewPullRequest: OverviewPullRequest | undefined;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
  // The table renders the review tags in a dedicated badge column, so it hides
  // the ones OverviewAction would otherwise stack under the button.
  showReviewTags?: boolean;
}) {
  const organization = useOrganization();
  const {pullRequests, status} = run;
  const trackPrClicked = (section: 'merged' | 'review_pr', pr: OverviewPullRequest) =>
    trackAnalytics('autofix.overview.pr_clicked', {
      organization,
      group_id: run.groupId,
      run_id: run.seerRunId,
      section,
      checks_status: pr.checksStatus ?? undefined,
      review_status: pr.reviewStatus ?? undefined,
    });
  if (status === 'processing') {
    return (
      <ActionButtonBar>
        <Button
          size="sm"
          variant="secondary"
          disabled
          aria-busy
          icon={<ButtonSpinner size={14} />}
        >
          {getProcessingLabel(sectionKey)}
        </Button>
        <OpenSeerButton run={run} section={sectionKey} size="sm" variant="secondary" />
      </ActionButtonBar>
    );
  }

  if (sectionKey === 'merged') {
    if (pullRequests.length > 0) {
      return (
        <Stack gap="xs" align={{xs: 'start', sm: 'end'}} width="100%">
          {pullRequests.map(pullRequest => {
            const label = t('Merged #%s', pullRequest.number);
            const title = t('The pull request for this fix was merged.');
            if (!pullRequest.url) {
              return (
                <Tooltip key={pullRequest.id} title={title} skipWrapper>
                  <Tag variant="muted" icon={<IconMerge />}>
                    {label}
                  </Tag>
                </Tooltip>
              );
            }
            return (
              <ActionButtonBar key={pullRequest.id}>
                <Tooltip title={title} skipWrapper>
                  <LinkButton
                    size="sm"
                    variant="secondary"
                    icon={<IconMerge />}
                    href={pullRequest.url}
                    external
                    onClick={() => trackPrClicked('merged', pullRequest)}
                  >
                    {label}
                  </LinkButton>
                </Tooltip>
                <OpenSeerButton
                  run={run}
                  section={sectionKey}
                  size="sm"
                  variant="secondary"
                />
              </ActionButtonBar>
            );
          })}
        </Stack>
      );
    }
    return (
      <Tooltip title={t('The pull request for this fix was merged.')}>
        <Tag variant="success" icon={<IconMerge />}>
          {t('Merged')}
        </Tag>
      </Tooltip>
    );
  }

  if (sectionKey === 'review_pr' && reviewPullRequest?.url) {
    return (
      <Stack align={{xs: 'start', sm: 'end'}} gap="xs" width="100%">
        <ActionButtonBar>
          <LinkButton
            size="sm"
            variant="primary"
            href={reviewPullRequest.url}
            external
            onClick={() => trackPrClicked('review_pr', reviewPullRequest)}
          >
            <Flex as="span" gap="xs" align="center">
              {t('Review PR #%s', reviewPullRequest.number)}
              <IconOpen size="xs" />
            </Flex>
          </LinkButton>
          <OpenSeerButton run={run} section={sectionKey} size="sm" variant="primary" />
        </ActionButtonBar>
        {showReviewTags && <ReviewPrStatusTags pullRequest={reviewPullRequest} />}
      </Stack>
    );
  }

  if (sectionKey === 'review_pr') {
    return (
      <ActionButtonBar>
        <Tooltip title={REVIEW_PR_META.description} skipWrapper>
          <LinkButton
            size="sm"
            variant="secondary"
            icon={<REVIEW_PR_META.Icon />}
            to={issueUrl}
          >
            {REVIEW_PR_META.label}
          </LinkButton>
        </Tooltip>
      </ActionButtonBar>
    );
  }

  return (
    <OverviewCardAction run={run} sectionKey={sectionKey} projectConfig={projectConfig} />
  );
}

export const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

// ErrorLevel's colored line stretched from its 1em inline size into an accent
// bar spanning the full title block (its grid cell stretches it).
export const LevelBar = styled(ErrorLevel)`
  height: auto;
  width: 4px;
`;

export function PriorityAndAssignee({
  run,
  memberList,
  assigneeReady,
}: {
  assigneeReady: boolean;
  run: OverviewRun;
  memberList?: User[];
}) {
  const {issue} = run;
  const priorityGroup: OverviewIssuePriorityGroup = {
    id: run.groupId,
    priority: issue.priority,
    priorityLockedAt: issue.priorityLockedAt,
    // The endpoint may null these out; the reused priority widget needs values.
    issueType: issue.issueType ?? IssueType.ERROR,
    issueCategory: issue.issueCategory ?? IssueCategory.ERROR,
    level: issue.level ?? 'unknown',
    lastSeen: issue.lastSeen ?? run.lastTriggeredAt,
    count: issue.count ?? '0',
    owners: issue.owners,
    assignedTo: issue.assignedTo,
    project: {id: issue.project.id},
  };
  return (
    <Flex gap="xs" align="center">
      <OverviewIssuePriority group={priorityGroup} />
      {assigneeReady ? (
        <OverviewIssueAssignee
          groupId={run.groupId}
          projectId={issue.project.id}
          projectSlug={issue.project.slug}
          assignedTo={issue.assignedTo ?? undefined}
          owners={issue.owners}
          memberList={memberList}
        />
      ) : (
        <Placeholder shape="circle" width="24px" height="24px" />
      )}
    </Flex>
  );
}

function IssueVitals({
  run,
  statsPeriod,
  vitalsPending,
}: {
  run: OverviewRun;
  statsPeriod: string | null;
  vitalsPending: boolean;
}) {
  const eventCount = run.issue.count ? Number(run.issue.count) : null;
  const userCount = run.issue.userCount ?? null;
  const windowLabel = periodWindowLabel(statsPeriod);
  // lastTriggeredAt rides the status poll, so keep it visible even while the
  // Snuba-sourced counts are still shimmering in.
  const seerActivity = (
    <Flex gap="xs" align="center">
      <IconSeer size="xs" variant="muted" aria-hidden />
      <Text size="sm" variant="muted">
        <TimeSince
          date={run.lastTriggeredAt}
          tooltipPrefix={t('Last activity on this Seer run')}
        />
      </Text>
    </Flex>
  );
  if (vitalsPending) {
    return (
      <Fragment>
        <Flex gap="xs" align="center">
          <IconGraph size="xs" variant="muted" aria-hidden />
          <Placeholder height="1rem" width="4rem" />
        </Flex>
        <Flex gap="xs" align="center">
          <IconUser size="xs" variant="muted" aria-hidden />
          <Placeholder height="1rem" width="4rem" />
        </Flex>
        <Flex gap="xs" align="center">
          <IconClock size="xs" variant="muted" aria-hidden />
          <Placeholder height="1rem" width="5rem" />
        </Flex>
        {seerActivity}
      </Fragment>
    );
  }
  return (
    <Fragment>
      {eventCount !== null && (
        <Flex gap="xs" align="center">
          <IconGraph size="xs" variant="muted" aria-hidden />
          <InfoText
            size="sm"
            variant="muted"
            title={
              windowLabel
                ? t('%s events %s', eventCount.toLocaleString(), windowLabel)
                : t('%s events', eventCount.toLocaleString())
            }
          >
            {eventCount === 1
              ? t('1 event')
              : t('%s events', formatAbbreviatedNumber(eventCount))}
          </InfoText>
        </Flex>
      )}
      {userCount !== null && (
        <Flex gap="xs" align="center">
          <IconUser size="xs" variant="muted" aria-hidden />
          <InfoText
            size="sm"
            variant="muted"
            title={
              windowLabel
                ? t('%s affected users %s', userCount.toLocaleString(), windowLabel)
                : t('%s affected users', userCount.toLocaleString())
            }
          >
            {userCount === 1
              ? t('1 user')
              : t('%s users', formatAbbreviatedNumber(userCount))}
          </InfoText>
        </Flex>
      )}
      {run.issue.lastSeen && (
        <Flex gap="xs" align="center">
          <IconClock size="xs" variant="muted" aria-hidden />
          <Text size="sm" variant="muted">
            <TimeSince
              date={run.issue.lastSeen}
              tooltipPrefix={t('The most recent event in this issue occurred')}
            />
          </Text>
        </Flex>
      )}
      {seerActivity}
    </Fragment>
  );
}

// The issue title block (level bar + title link + project/shortId + vitals),
// shared so the card and the table render an identical left column.
export function OverviewIssueTitle({
  run,
  orgSlug,
  sectionKey,
  statsPeriod,
  vitalsPending,
}: {
  orgSlug: string;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
  statsPeriod: string | null;
  vitalsPending: boolean;
}) {
  const organization = useOrganization();
  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  return (
    // Grid, not flex: items stretch by default, so the level bar spans every
    // wrapped title line and the text cell can't escape the row.
    <Grid columns="max-content minmax(0, 1fr)" gap="sm">
      <LevelBar level={run.issue.level ?? undefined} />
      <Stack minWidth="0" gap="xs">
        <Text bold display="block" textWrap="pretty" wordBreak="break-word" size="lg">
          <TitleLink
            to={issueUrl}
            onClick={() =>
              trackAnalytics('autofix.overview.issue_clicked', {
                organization,
                group_id: run.groupId,
                run_id: run.seerRunId,
                section: sectionKey,
              })
            }
          >
            {run.title}
          </TitleLink>
        </Text>
        <Flex wrap="wrap" gap="md" align="center">
          <Flex gap="xs" align="center">
            <ProjectAvatar
              project={run.issue.project}
              size={12}
              hasTooltip
              tooltip={run.issue.project.slug}
            />
            <Text size="sm" monospace variant="muted">
              {run.shortId}
            </Text>
          </Flex>
          <IssueVitals
            run={run}
            statsPeriod={statsPeriod}
            vitalsPending={vitalsPending}
          />
        </Flex>
      </Stack>
    </Grid>
  );
}

// The collapsible section shell (icon + label + count header) shared by the card
// list and the table so both group runs identically.
export function OverviewSectionDisclosure({
  sectionKey,
  count,
  expanded,
  onToggle,
  children,
}: {
  children: React.ReactNode;
  count: number;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  sectionKey: StatusGroupKey;
}) {
  const meta = STATUS_GROUP_META[sectionKey];
  const groupLabel = sectionKey === 'needs_investigation' ? t('Create Plan') : meta.label;
  return (
    <StatusGroup size="sm" expanded={expanded} onExpandedChange={onToggle}>
      <GroupHeader>
        <Disclosure.Title>
          <Flex gap="sm" align="center">
            <Tooltip title={<StatusGroupTooltip groupKey={sectionKey} />} skipWrapper>
              <meta.Icon size="sm" aria-hidden />
            </Tooltip>
            <Text bold>{groupLabel}</Text>
            <Badge variant="muted">{count}</Badge>
          </Flex>
        </Disclosure.Title>
      </GroupHeader>
      <Disclosure.Content>{children}</Disclosure.Content>
    </StatusGroup>
  );
}
