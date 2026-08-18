import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag, type TagProps} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconBug,
  IconCheckmark,
  IconCircle,
  IconClock,
  IconClose,
  IconCommit,
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
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

import {CodeChanges} from './codeChanges';
import {OverviewCardAction} from './overviewCardAction';
import {OverviewIssueAssignee} from './overviewIssueAssignee';
import {
  OverviewIssuePriority,
  type OverviewIssuePriorityGroup,
} from './overviewIssuePriority';
import {periodWindowLabel} from './periods';
import {PullRequestFiles} from './pullRequestFiles';
import type {AutofixStateKey, OverviewPullRequest, OverviewRun} from './types';

// The endpoint orders links oldest-first and only enriches open/draft PRs, so
// the newest actionable link is the one carrying badges and files.
function selectReviewPullRequest(
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

const CHECKS_STATUS_TAGS = {
  failure: {
    icon: <IconClose />,
    label: t('Checks Failing'),
    variant: 'danger',
  },
  pending: {
    icon: <IconCircle />,
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

function OverviewAction({
  sectionKey,
  run,
  reviewPullRequest,
  issueUrl,
  enrichmentPending,
}: {
  enrichmentPending: boolean;
  issueUrl: string;
  reviewPullRequest: OverviewPullRequest | undefined;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
}) {
  const {pullRequests} = run;
  if (sectionKey === 'merged') {
    if (pullRequests.length > 0) {
      return (
        <Stack gap="xs" align="end">
          {pullRequests.map(pullRequest => {
            const label = t('Merged #%s', pullRequest.number);
            return (
              <Tooltip
                key={pullRequest.id}
                title={t('The pull request for this fix was merged.')}
                skipWrapper
              >
                {pullRequest.url ? (
                  <LinkButton
                    size="sm"
                    variant="secondary"
                    icon={<IconMerge />}
                    href={pullRequest.url}
                    external
                  >
                    {label}
                  </LinkButton>
                ) : (
                  <Tag variant="muted" icon={<IconMerge />}>
                    {label}
                  </Tag>
                )}
              </Tooltip>
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
    const checksStatusTag = reviewPullRequest.checksStatus
      ? CHECKS_STATUS_TAGS[reviewPullRequest.checksStatus]
      : null;
    const reviewStatusTag = reviewPullRequest.reviewStatus
      ? REVIEW_STATUS_TAGS[reviewPullRequest.reviewStatus]
      : null;
    const failedChecks =
      reviewPullRequest.checksStatus === 'failure'
        ? (reviewPullRequest.failedChecks ?? [])
        : [];

    return (
      <Stack align="end" gap="xs">
        <Tooltip title={REVIEW_PR_META.description} skipWrapper>
          <LinkButton size="sm" variant="primary" href={reviewPullRequest.url} external>
            <Flex as="span" gap="xs" align="center">
              {t('Review PR #%s', reviewPullRequest.number)}
              <IconOpen size="xs" />
            </Flex>
          </LinkButton>
        </Tooltip>
        {enrichmentPending ? (
          // Two slots mirror the review + checks tags the enriched response
          // typically fills in, so the row height doesn't jump on resolve.
          <Fragment>
            <Placeholder height="1.25rem" width="5.5rem" />
            <Placeholder height="1.25rem" width="7rem" />
          </Fragment>
        ) : (
          <Fragment>
            {reviewStatusTag && (
              <Tag variant={reviewStatusTag.variant} icon={reviewStatusTag.icon}>
                {reviewStatusTag.label}
              </Tag>
            )}
            {checksStatusTag && (
              <Tooltip
                disabled={failedChecks.length === 0}
                title={
                  <Stack gap="xs" align="start">
                    <Text size="sm" bold>
                      {t('Failing checks:')}
                    </Text>
                    {failedChecks.map((name, index) => (
                      <Text key={`${name}-${index}`} size="sm">
                        {name}
                      </Text>
                    ))}
                  </Stack>
                }
              >
                <Tag variant={checksStatusTag.variant} icon={checksStatusTag.icon}>
                  {failedChecks.length > 0
                    ? tn('%s Check Failing', '%s Checks Failing', failedChecks.length)
                    : checksStatusTag.label}
                </Tag>
              </Tooltip>
            )}
          </Fragment>
        )}
      </Stack>
    );
  }

  // A review_pr card without a PR URL keeps the plain issue link fallback.
  if (sectionKey === 'review_pr') {
    return (
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
    );
  }

  return <OverviewCardAction run={run} sectionKey={sectionKey} issueUrl={issueUrl} />;
}

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

// ErrorLevel's colored line stretched from its 1em inline size into an accent
// bar spanning the full title block (its grid cell stretches it).
const LevelBar = styled(ErrorLevel)`
  height: auto;
  width: 4px;
`;

function NarrativeBlock({
  icon,
  label,
  children,
}: {
  children: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Stack gap="xs">
      <Flex gap="xs" align="center">
        {icon}
        <Text size="xs" bold uppercase variant="secondary">
          {label}
        </Text>
      </Flex>
      <Text size={{xs: 'md', lg: 'lg'}} density="comfortable" wordBreak="break-word">
        {children}
      </Text>
    </Stack>
  );
}

function IssueVitals({
  run,
  statsPeriod,
  enrichmentPending,
}: {
  enrichmentPending: boolean;
  run: OverviewRun;
  statsPeriod: string | null;
}) {
  const eventCount = run.issue.count ? Number(run.issue.count) : null;
  const userCount = run.issue.userCount ?? 0;
  const windowLabel = periodWindowLabel(statsPeriod);
  return (
    <Fragment>
      {enrichmentPending ? (
        <Fragment>
          <Flex gap="xs" align="center">
            <IconGraph size="xs" variant="muted" aria-hidden />
            <Placeholder height="1rem" width="4rem" />
          </Flex>
          <Flex gap="xs" align="center">
            <IconClock size="xs" variant="muted" aria-hidden />
            <Placeholder height="1rem" width="5rem" />
          </Flex>
        </Fragment>
      ) : (
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
          {userCount > 0 && (
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
        </Fragment>
      )}
      <Flex gap="xs" align="center">
        <IconSeer size="xs" variant="muted" aria-hidden />
        <Text size="sm" variant="muted">
          <TimeSince
            date={run.lastTriggeredAt}
            tooltipPrefix={t('Last activity on this Seer run')}
          />
        </Text>
      </Flex>
    </Fragment>
  );
}

function PriorityAndAssignee({run}: {run: OverviewRun}) {
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
      <OverviewIssueAssignee
        groupId={run.groupId}
        projectId={issue.project.id}
        projectSlug={issue.project.slug}
        assignedTo={issue.assignedTo ?? undefined}
        owners={issue.owners}
      />
    </Flex>
  );
}

export function OverviewCard({
  orgSlug,
  run,
  sectionKey,
  statsPeriod,
  enrichmentPending,
}: {
  enrichmentPending: boolean;
  orgSlug: string;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
  statsPeriod: string | null;
}) {
  const rootCause = run.rootCause?.oneLineDescription;
  const proposedFix = run.proposedFix?.oneLineSummary;
  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  const reviewPullRequest =
    sectionKey === 'review_pr' ? selectReviewPullRequest(run.pullRequests) : undefined;
  const changedFiles = reviewPullRequest?.files ?? [];

  return (
    <Container background="primary" border="primary" radius="md" padding="xl">
      <Stack gap="xl">
        <Flex
          gap={{xs: 'xl', sm: '3xl'}}
          align="stretch"
          justify="between"
          direction={{xs: 'column-reverse', sm: 'row'}}
        >
          <Stack gap="lg" minWidth="0" flex="1">
            {/* Grid, not flex: items stretch by default, so the level bar spans
                every wrapped title line and the text cell can't escape the row */}
            <Grid columns="max-content minmax(0, 1fr)" gap="sm">
              <LevelBar level={run.issue.level ?? undefined} />
              <Stack minWidth="0" gap="xs">
                <Text bold display="block" textWrap="pretty" size="lg">
                  <TitleLink to={issueUrl}>{run.title}</TitleLink>
                </Text>
                <Flex wrap="wrap" gap="md" align="center">
                  <Text size="sm" monospace variant="muted">
                    {run.shortId}
                  </Text>
                  <IssueVitals
                    run={run}
                    statsPeriod={statsPeriod}
                    enrichmentPending={enrichmentPending}
                  />
                </Flex>
              </Stack>
            </Grid>
            {rootCause && (
              <NarrativeBlock
                icon={<IconBug size="xs" variant="secondary" aria-hidden />}
                label={t('Root cause')}
              >
                {rootCause}
              </NarrativeBlock>
            )}
            {proposedFix && (
              <NarrativeBlock
                icon={<IconCommit size="xs" variant="secondary" aria-hidden />}
                label={t('Plan')}
              >
                {proposedFix}
              </NarrativeBlock>
            )}
            {sectionKey === 'code_changes_ready' && run.codeChanges?.length ? (
              <CodeChanges codeChanges={run.codeChanges} />
            ) : null}
            {enrichmentPending && reviewPullRequest?.url ? (
              <Placeholder height="3rem" />
            ) : reviewPullRequest && changedFiles.length > 0 ? (
              <PullRequestFiles orgSlug={orgSlug} pullRequest={reviewPullRequest} />
            ) : null}
          </Stack>

          {/* justify=between + parent align=stretch pins the action to the top
              and the priority/assignee controls to the bottom-right */}
          <Stack gap="lg" align="end" justify="between" flexShrink={0} minWidth="0">
            <OverviewAction
              sectionKey={sectionKey}
              run={run}
              reviewPullRequest={reviewPullRequest}
              issueUrl={issueUrl}
              enrichmentPending={enrichmentPending}
            />
            <PriorityAndAssignee run={run} />
          </Stack>
        </Flex>
      </Stack>
    </Container>
  );
}
