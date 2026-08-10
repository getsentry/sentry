import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DiffFileType, type FilePatch} from 'sentry/components/events/autofix/types';
import {
  PullRequestChecksBadge,
  PullRequestReviewBadge,
} from 'sentry/components/group/externalIssuesList/pullRequestStatusBadge';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconClock,
  IconCode,
  IconCommit,
  IconFocus,
  IconGraph,
  IconMerge,
  IconOpen,
  IconPullRequest,
  IconSearch,
  IconSeer,
  IconUser,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';
import type {AutofixStateKey} from 'sentry/views/seerWorkflows/overview/types';

import {OverviewIssueAssignee} from '../overview/overviewIssueAssignee';
import {
  OverviewIssuePriority,
  type OverviewIssuePriorityGroup,
} from '../overview/overviewIssuePriority';
import {periodWindowLabel} from '../overview/periods';

import type {OverviewPullRequestFile, OverviewRun} from './types';

// Milestone-driven action per section, reusing the original page's copy. Live
// status overlays (Running/Retry/Add context) are intentionally omitted here.
const ACTION_META: Record<
  Exclude<AutofixStateKey, 'merged'>,
  {Icon: React.ComponentType<SVGIconProps>; description: string; label: string}
> = {
  review_pr: {
    Icon: IconPullRequest,
    label: t('Review PR'),
    description: t('Autofix opened a pull request. Review and merge it.'),
  },
  code_changes_ready: {
    Icon: IconCommit,
    label: t('Draft PR'),
    description: t('Autofix wrote a diff. Review it and open a pull request.'),
  },
  solution_ready: {
    Icon: IconCode,
    label: t('Generate code'),
    description: t('Autofix proposed a fix. Continue the pipeline to generate code.'),
  },
  needs_investigation: {
    Icon: IconSearch,
    label: t('Create Plan'),
    description: t('Seer stopped at a diagnosis. Review the root cause to continue.'),
  },
};

function Overview2Action({
  sectionKey,
  run,
  issueUrl,
}: {
  issueUrl: string;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
}) {
  if (sectionKey === 'merged') {
    return (
      <Tooltip title={t('The pull request for this fix was merged.')}>
        <Tag variant="success" icon={<IconMerge />}>
          {t('Merged')}
        </Tag>
      </Tooltip>
    );
  }

  const pullRequest = run.pullRequests[0];
  if (sectionKey === 'review_pr' && pullRequest?.url) {
    return (
      <Flex align="center" gap="xs">
        {pullRequest.checksStatus && (
          <PullRequestChecksBadge status={pullRequest.checksStatus} />
        )}
        {pullRequest.reviewStatus && (
          <PullRequestReviewBadge status={pullRequest.reviewStatus} />
        )}
        <Tooltip title={ACTION_META.review_pr.description} skipWrapper>
          <LinkButton size="sm" variant="primary" href={pullRequest.url} external>
            <Flex as="span" gap="xs" align="center">
              {t('Review PR #%s', pullRequest.number)}
              <IconOpen size="xs" />
            </Flex>
          </LinkButton>
        </Tooltip>
      </Flex>
    );
  }

  const meta = ACTION_META[sectionKey];
  return (
    <Tooltip title={meta.description} skipWrapper>
      <LinkButton size="sm" variant="secondary" icon={<meta.Icon />} to={issueUrl}>
        {meta.label}
      </LinkButton>
    </Tooltip>
  );
}

function toFilePatch(file: OverviewPullRequestFile): FilePatch {
  return {
    path: file.path,
    added: file.additions,
    removed: file.deletions,
    source_file: file.path,
    target_file: file.path,
    type: DiffFileType.MODIFIED,
    hunks: [],
  };
}

function PullRequestFiles({files}: {files: OverviewPullRequestFile[]}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {files.length === 1
          ? t('1 file changed')
          : t('%s files changed', files.length.toLocaleString())}
      </Text>
      <FileDiffList>
        {files.map(file => (
          <FileDiffViewer
            key={file.path}
            patch={toFilePatch(file)}
            showBorder
            collapsible
            defaultExpanded={false}
          />
        ))}
      </FileDiffList>
    </Stack>
  );
}

const FileDiffList = styled(Stack)`
  & > :not(:first-child) {
    border-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  & > :not(:last-child) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

function NarrativeBlock({
  icon,
  label,
  variant,
  children,
}: {
  children: string;
  icon: React.ReactNode;
  label: string;
  variant: 'muted' | 'success';
}) {
  return (
    <Stack gap="xs" maxWidth="70ch">
      <Flex gap="xs" align="center">
        {icon}
        <Text size="xs" bold uppercase variant={variant}>
          {label}
        </Text>
      </Flex>
      <Text size={{xs: 'md', lg: 'lg'}} density="comfortable" wordBreak="break-word">
        {children}
      </Text>
    </Stack>
  );
}

function IssueVitals({run, statsPeriod}: {run: OverviewRun; statsPeriod: string}) {
  const eventCount = Number(run.issue.count) || 0;
  const {userCount} = run.issue;
  return (
    <Fragment>
      <Flex gap="xs" align="center">
        <IconGraph size="xs" variant="muted" aria-hidden />
        <InfoText
          size="sm"
          variant="muted"
          title={t(
            '%s events %s',
            eventCount.toLocaleString(),
            periodWindowLabel(statsPeriod)
          )}
        >
          {eventCount === 1
            ? t('1 event')
            : t('%s events', formatAbbreviatedNumber(eventCount))}
        </InfoText>
      </Flex>
      {userCount > 0 && (
        <Flex gap="xs" align="center">
          <IconUser size="xs" variant="muted" aria-hidden />
          <InfoText
            size="sm"
            variant="muted"
            title={t(
              '%s affected users %s',
              userCount.toLocaleString(),
              periodWindowLabel(statsPeriod)
            )}
          >
            {userCount === 1
              ? t('1 user')
              : t('%s users', formatAbbreviatedNumber(userCount))}
          </InfoText>
        </Flex>
      )}
      <Flex gap="xs" align="center">
        <IconClock size="xs" variant="muted" aria-hidden />
        <Text size="sm" variant="muted">
          <TimeSince
            date={run.issue.lastSeen}
            tooltipPrefix={t('The most recent event in this issue occurred')}
          />
        </Text>
      </Flex>
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
    issueType: issue.issueType,
    issueCategory: issue.issueCategory,
    level: issue.level,
    lastSeen: issue.lastSeen,
    count: issue.count,
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

export function Overview2Card({
  orgSlug,
  run,
  sectionKey,
  statsPeriod,
}: {
  orgSlug: string;
  run: OverviewRun;
  sectionKey: AutofixStateKey;
  statsPeriod: string;
}) {
  const rootCause = run.rootCause?.oneLineDescription;
  const proposedFix = run.proposedFix?.oneLineSummary;
  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  const changedFiles =
    sectionKey === 'review_pr' ? (run.pullRequests[0]?.files ?? []) : [];

  return (
    <Container background="primary" border="primary" radius="md" padding="xl">
      <Stack gap="xl">
        <Flex
          gap={{xs: 'xl', sm: '3xl'}}
          align={{xs: 'stretch', sm: 'start'}}
          justify="between"
          direction={{xs: 'column-reverse', sm: 'row'}}
        >
          <Stack gap="lg" minWidth="0" flex="1">
            <Text bold display="block" textWrap="pretty" size="lg">
              <TitleLink to={issueUrl}>{run.title}</TitleLink>
            </Text>
            {rootCause && (
              <NarrativeBlock
                icon={<IconFocus size="xs" variant="muted" aria-hidden />}
                label={t('Root cause')}
                variant="muted"
              >
                {rootCause}
              </NarrativeBlock>
            )}
            {proposedFix && (
              <NarrativeBlock
                icon={<IconCommit size="xs" variant="success" aria-hidden />}
                label={t('Proposed fix')}
                variant="success"
              >
                {proposedFix}
              </NarrativeBlock>
            )}
          </Stack>

          <Stack gap="sm" align="start" flexShrink={0} minWidth="0">
            <Overview2Action sectionKey={sectionKey} run={run} issueUrl={issueUrl} />
            <Text size="sm" monospace variant="muted" ellipsis>
              {run.shortId}
            </Text>
            <IssueVitals run={run} statsPeriod={statsPeriod} />
            <PriorityAndAssignee run={run} />
          </Stack>
        </Flex>
        {changedFiles.length > 0 && <PullRequestFiles files={changedFiles} />}
      </Stack>
    </Container>
  );
}
