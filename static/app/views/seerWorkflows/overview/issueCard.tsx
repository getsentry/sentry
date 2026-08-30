import {Fragment, memo, useEffect, useRef} from 'react';
import {keyframes, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconBug,
  IconCheckmark,
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
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {HoverOverlayGroupProvider} from 'sentry/utils/useHoverOverlay';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CodeChanges} from './codeChanges';
import {OpenSeerButton} from './openSeerButton';
import {getProcessingLabel} from './overviewActions';
import {ActionButtonBar, ButtonSpinner, OverviewCardAction} from './overviewCardAction';
import {OverviewIssueAssignee} from './overviewIssueAssignee';
import {
  OverviewIssuePriority,
  type OverviewIssuePriorityGroup,
} from './overviewIssuePriority';
import {periodWindowLabel} from './periods';
import {PullRequestFiles} from './pullRequestFiles';
import type {
  AutofixStateKey,
  OverviewPullRequest,
  OverviewRun,
  ProjectConfig,
} from './types';
import {useIsInView} from './useIsInView';

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

function OverviewAction({
  sectionKey,
  run,
  reviewPullRequest,
  issueUrl,
  projectConfig,
}: {
  issueUrl: string;
  projectConfig: ProjectConfig | undefined;
  reviewPullRequest: OverviewPullRequest | undefined;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
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
        <OpenSeerButton run={run} section={sectionKey} size="sm" />
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
                <OpenSeerButton run={run} section={sectionKey} size="sm" />
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
    const checksStatusTag = reviewPullRequest.checksStatus
      ? CHECKS_STATUS_TAGS[reviewPullRequest.checksStatus]
      : null;
    const reviewStatusTag = reviewPullRequest.reviewStatus
      ? REVIEW_STATUS_TAGS[reviewPullRequest.reviewStatus]
      : null;
    const failedChecks =
      reviewPullRequest.checksStatus === 'failure'
        ? (reviewPullRequest.failedCheckDetails ?? [])
        : [];

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

const NARRATIVE_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Paragraph: ({children}) => (
    <Text
      as="p"
      size="sm"
      variant="secondary"
      bold={false}
      tabular
      wordBreak="break-word"
    >
      {children}
    </Text>
  ),
};

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
        <Text size="xs" bold variant="secondary">
          {label}
        </Text>
      </Flex>
      <Markdown raw={children} components={NARRATIVE_MARKDOWN_COMPONENTS} />
    </Stack>
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

function PriorityAndAssignee({
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

export const OverviewCard = memo(function OverviewCardComponent({
  orgSlug,
  run,
  sectionKey,
  statsPeriod,
  scmSettled,
  vitalsPending,
  requestScmWindow,
  scmWindows,
  projectConfig,
  memberList,
  assigneeReady,
}: {
  assigneeReady: boolean;
  orgSlug: string;
  projectConfig: ProjectConfig | undefined;
  requestScmWindow: (runIds: string[]) => void;
  run: OverviewRun;
  scmSettled: boolean;
  scmWindows: string[][] | undefined;
  sectionKey: AutofixStateKey;
  statsPeriod: string | null;
  vitalsPending: boolean;
  memberList?: User[];
}) {
  const organization = useOrganization();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useIsInView(cardRef);
  useEffect(() => {
    if (inView && scmWindows) {
      for (const window of scmWindows) {
        requestScmWindow(window);
      }
    }
  }, [inView, scmWindows, requestScmWindow]);
  const headline = run.rootCause?.headline;
  const rootCause = run.rootCause?.oneLineDescription;
  const proposedFix = run.proposedFix?.oneLineSummary;
  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  const reviewPullRequest =
    sectionKey === 'review_pr' ? selectReviewPullRequest(run.pullRequests) : undefined;
  const changedFiles = reviewPullRequest?.files ?? [];
  const hasEnrichment = Boolean(
    reviewPullRequest?.checksStatus ||
    reviewPullRequest?.reviewStatus ||
    reviewPullRequest?.files?.length
  );
  const enrichmentPending =
    Boolean(reviewPullRequest?.url) && !hasEnrichment && !scmSettled;
  const trackCodeChangesExpanded = () =>
    trackAnalytics('autofix.overview.code_changes_expanded', {
      organization,
      group_id: run.groupId,
      run_id: run.seerRunId,
      section: sectionKey,
    });

  const showCodeChanges = Boolean(
    sectionKey === 'code_changes_ready' && run.codeChanges?.length
  );
  const showEnrichmentPlaceholder = enrichmentPending && Boolean(reviewPullRequest?.url);
  const showPullRequestFiles =
    !showEnrichmentPlaceholder && Boolean(reviewPullRequest) && changedFiles.length > 0;
  const hasBody = Boolean(
    rootCause ||
    proposedFix ||
    showCodeChanges ||
    showEnrichmentPlaceholder ||
    showPullRequestFiles
  );

  return (
    <CardFrame
      containerRef={cardRef}
      title={
        // Grid, not flex: items stretch by default, so the level bar spans
        // every wrapped title line and the text cell can't escape the row
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
                {headline || run.title}
              </TitleLink>
            </Text>
            {headline && (
              <Text size="sm" variant="muted" ellipsis>
                {run.title}
              </Text>
            )}
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
      }
      meta={
        <PriorityAndAssignee
          run={run}
          memberList={memberList}
          assigneeReady={assigneeReady}
        />
      }
      actions={
        <OverviewAction
          sectionKey={sectionKey}
          run={run}
          reviewPullRequest={reviewPullRequest}
          issueUrl={issueUrl}
          projectConfig={projectConfig}
        />
      }
      body={
        hasBody ? (
          <Fragment>
            {rootCause && (
              <NarrativeBlock
                icon={<IconBug size="xs" variant="secondary" aria-hidden />}
                label={t('Root Cause')}
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
            {showCodeChanges && run.codeChanges ? (
              <CodeChanges
                codeChanges={run.codeChanges}
                onFirstExpand={trackCodeChangesExpanded}
              />
            ) : null}
            {showEnrichmentPlaceholder ? (
              <Placeholder height="3rem" />
            ) : showPullRequestFiles && reviewPullRequest ? (
              <PullRequestFiles
                orgSlug={orgSlug}
                pullRequest={reviewPullRequest}
                onFirstExpand={trackCodeChangesExpanded}
              />
            ) : null}
          </Fragment>
        ) : undefined
      }
    />
  );
});

function CardFrame({
  actions,
  body,
  meta,
  title,
  containerRef,
}: {
  actions: React.ReactNode;
  meta: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Container
      ref={containerRef}
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
    >
      <Grid
        areas={{
          xs: body ? `"title" "meta" "body" "actions"` : `"title" "meta" "actions"`,
          sm: body ? `"title aside" "body aside"` : `"title aside"`,
        }}
        columns={{xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) max-content'}}
        rows={{xs: 'auto', sm: body ? 'auto 1fr' : 'auto'}}
        gap={{xs: 'lg', sm: 'lg 3xl'}}
      >
        <Container area="title" minWidth="0">
          {title}
        </Container>
        {body ? (
          <Stack area="body" gap="lg" minWidth="0">
            {body}
          </Stack>
        ) : null}
        <Aside gap="lg" align="end" justify="between">
          <Stack area="actions" align={{xs: 'start', sm: 'end'}}>
            {actions}
          </Stack>
          <Flex area="meta" align="center">
            {meta}
          </Flex>
        </Aside>
      </Grid>
    </Container>
  );
}

const Aside = styled(Stack)`
  grid-area: aside;

  @container (width < ${p => p.theme.container.sm}) {
    && {
      display: contents;
    }
  }
`;

export function TextLineSkeleton({
  size,
  width,
}: {
  size: 'xs' | 'sm' | 'md' | 'lg';
  width: string;
}) {
  return (
    <Text as="div" size={size}>
      <Placeholder height="1lh" width={width} />
    </Text>
  );
}

export function OverviewCardSkeleton() {
  const theme = useTheme();
  return (
    <CardFrame
      title={
        <Grid columns="max-content minmax(0, 1fr)" gap="sm">
          <LevelBar />
          <Stack minWidth="0" gap="xs">
            <TextLineSkeleton size="lg" width="70%" />
            <Flex wrap="wrap" gap="md" align="center">
              {['4.5rem', '4rem', '4rem', '5rem', '5rem'].map((width, index) => (
                <TextLineSkeleton key={index} size="sm" width={width} />
              ))}
            </Flex>
          </Stack>
        </Grid>
      }
      meta={
        <Flex gap="xs">
          <Placeholder height={theme.form.xs.height} width={theme.form.xs.height} />
          <Placeholder height={theme.form.xs.height} width={theme.form.xs.height} />
        </Flex>
      }
      actions={<Placeholder height={theme.form.sm.height} width="9rem" />}
      body={
        <Fragment>
          {['90%', '75%'].map((width, index) => (
            <Stack key={index} gap="xs">
              <TextLineSkeleton size="xs" width="4rem" />
              <TextLineSkeleton size="sm" width={width} />
            </Stack>
          ))}
          <Placeholder />
        </Fragment>
      }
    />
  );
}
