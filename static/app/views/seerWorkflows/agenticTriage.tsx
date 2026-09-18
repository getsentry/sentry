import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Prose, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getPullRequestStatusLabel} from 'sentry/components/group/externalIssuesList/pullRequestStatusBadge';
import {IconMerge, IconOpen, IconPullRequest, IconPullRequestClosed} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {PullRequestStatus} from 'sentry/types/integrations';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {TagVariant} from 'sentry/utils/theme';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';
import type {
  SeerAgenticTriageRun,
  SeerAgenticTriageRunIssue,
  SeerAgenticTriageRunPullRequest,
  SeerAgenticTriageRunErrorType,
  WorkflowDisplayStatus,
} from 'sentry/views/seerWorkflows/types';

export function getAgenticTriageSummary(run: SeerAgenticTriageRun): string {
  if (getAgenticTriageStatus(run) === 'running') {
    return t('Triaging issues…');
  }
  const error = getTriageErrorPresentation(run.errorType ?? null);
  if (error || run.extras.status === 'failed') {
    return error?.resultText ?? t('Run failed');
  }
  if (run.extras.options?.dry_run) {
    return t('dry run');
  }
  const issueCount = run.issues.length;
  return issueCount === 0
    ? t('No issues processed')
    : tn('%s issue', '%s issues', issueCount);
}

export function getAgenticTriageStatus(run: SeerAgenticTriageRun): WorkflowDisplayStatus {
  const error = getTriageErrorPresentation(run.errorType ?? null);
  if (error) {
    return error.status;
  }
  return run.extras.status && run.extras.status !== 'complete'
    ? run.extras.status
    : 'succeeded';
}

export function AgenticTriageResults({
  run,
  organizationSlug,
}: {
  organizationSlug: string;
  run: SeerAgenticTriageRun;
}) {
  return (
    <Stack gap="lg">
      <TriageDispatchesPanel run={run} />
      <IssueList
        issues={run.issues ?? []}
        organizationSlug={organizationSlug}
        isRunning={getAgenticTriageStatus(run) === 'running'}
      />
    </Stack>
  );
}

export function AgenticTriageDebug({run}: {run: SeerAgenticTriageRun}) {
  const {
    reasoning_effort,
    intelligence_level,
    extra_triage_instructions,
    max_candidates,
  } = run.extras.options ?? {};
  const hasSettings =
    reasoning_effort !== undefined ||
    intelligence_level !== undefined ||
    extra_triage_instructions !== undefined ||
    max_candidates !== undefined;

  return (
    <Stack gap="md">
      <Grid columns="max-content 1fr" gap="sm xl" align="start">
        <Text bold size="xs" variant="muted">
          {t('Run ID')}
        </Text>
        <Text size="sm" monospace>
          {run.id}
        </Text>
        {hasSettings ? (
          <Fragment>
            {max_candidates === undefined ? null : (
              <Fragment>
                <Text bold size="xs" variant="muted">
                  {t('Max candidates')}
                </Text>
                <Text size="sm">{max_candidates}</Text>
              </Fragment>
            )}
            {reasoning_effort === undefined ? null : (
              <Fragment>
                <Text bold size="xs" variant="muted">
                  {t('Reasoning effort')}
                </Text>
                <Text size="sm">{reasoning_effort}</Text>
              </Fragment>
            )}
            {intelligence_level === undefined ? null : (
              <Fragment>
                <Text bold size="xs" variant="muted">
                  {t('Intelligence level')}
                </Text>
                <Text size="sm">{intelligence_level}</Text>
              </Fragment>
            )}
            {extra_triage_instructions === undefined ? null : (
              <Fragment>
                <Text bold size="xs" variant="muted">
                  {t('Extra triage instructions')}
                </Text>
                <Text size="sm">{extra_triage_instructions}</Text>
              </Fragment>
            )}
          </Fragment>
        ) : null}
      </Grid>
      {run.errorMessage ? (
        <Text variant="danger" size="sm" monospace>
          {t('Error: ')}
          {run.errorMessage}
        </Text>
      ) : null}
      <TriageIssuesDebugAddendum run={run} />
    </Stack>
  );
}

function TriageDispatchesPanel({run}: {run: SeerAgenticTriageRun}) {
  const explorerRunIds = getTriageRunIds(run);
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Triage batches (%s)', explorerRunIds.length)}
      </Text>
      {explorerRunIds.length === 0 ? (
        <Text variant="muted" size="sm">
          {getAgenticTriageStatus(run) === 'running'
            ? t('No triage batches recorded yet.')
            : t('No triage batches recorded for this run.')}
        </Text>
      ) : (
        <Flex gap="sm" wrap="wrap">
          {explorerRunIds.map((runId, index) => (
            <LinkButton
              key={`${runId}-${index}`}
              size="xs"
              icon={<IconOpen />}
              to={getRelativeExplorerUrl(runId)}
            >
              {t('Batch %s', index + 1)}
            </LinkButton>
          ))}
        </Flex>
      )}
    </Stack>
  );
}

function IssueList({
  issues,
  organizationSlug,
  isRunning,
}: {
  isRunning: boolean;
  issues: SeerAgenticTriageRunIssue[];
  organizationSlug: string;
}) {
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Issues (%s)', issues.length)}
      </Text>

      {issues.length === 0 ? (
        <Text variant="muted" size="sm">
          {isRunning
            ? t('No issues processed yet.')
            : t('No issues processed in this run.')}
        </Text>
      ) : (
        <Stack gap="xs">
          {issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} organizationSlug={organizationSlug} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function IssueRow({
  issue,
  organizationSlug,
}: {
  issue: SeerAgenticTriageRunIssue;
  organizationSlug: string;
}) {
  const title = issue.groupTitle ?? issue.groupId;
  return (
    <Container background="primary" border="muted" radius="md" padding="sm md">
      <Stack gap="xs">
        <Flex justify="between" align="center" gap="md">
          <Container flex="1" minWidth="0">
            <Link to={`/organizations/${organizationSlug}/issues/${issue.groupId}/`}>
              <Text size="sm" ellipsis>
                {issue.groupShortId ? (
                  <Text bold as="span">
                    {issue.groupShortId}{' '}
                  </Text>
                ) : null}
                {title}
              </Text>
            </Link>
          </Container>
          <Stack gap="xs" align="end" flexShrink={0}>
            {(issue.pullRequests ?? []).length > 0 ? (
              (issue.pullRequests ?? []).map(pullRequest => (
                <IssuePullRequestChip
                  key={`${pullRequest.repository.id}:${pullRequest.id}`}
                  pullRequest={pullRequest}
                />
              ))
            ) : (
              <IssueStatusTag issue={issue} />
            )}
          </Stack>
        </Flex>
        {issue.reason ? (
          <Text size="sm" variant="muted" wordBreak="break-word" as="div">
            <MarkedText as={Prose} text={issue.reason} />
          </Text>
        ) : null}
      </Stack>
    </Container>
  );
}

const ACTION_TAG_VARIANT: Record<string, TagVariant> = {
  autofix: 'info',
  autofix_triggered: 'info',
  root_cause_only: 'muted',
  skip: 'muted',
};

function IssueStatusTag({issue}: {issue: SeerAgenticTriageRunIssue}) {
  const actionLabel = getActionLabel(issue.action);
  const label =
    issue.action === 'skip' && issue.skipReason
      ? `${actionLabel}: ${issue.skipReason.replaceAll('_', ' ')}`
      : actionLabel;
  const variant = ACTION_TAG_VARIANT[issue.action] ?? 'muted';
  if (!issue.seerRunId) {
    return <Tag variant={variant}>{label}</Tag>;
  }
  // The icon marks this tag as clickable, since most aren't.
  return (
    <Link to={getRelativeExplorerUrl(issue.seerRunId)}>
      <Tag variant={variant} icon={<IconOpen />}>
        {label}
      </Tag>
    </Link>
  );
}

// Matches the icon choices in pullRequestStatusBadge.tsx -- draft, open, and
// unknown fall back to the default IconPullRequest there too.
const PR_STATUS_ICON: Partial<Record<PullRequestStatus, typeof IconPullRequest>> = {
  merged: IconMerge,
  closed: IconPullRequestClosed,
};

// Only call out the status when it deviates from an ordinary open PR.
const PR_STATUS_PREFIXED = new Set<PullRequestStatus>(['merged', 'closed', 'draft']);

function IssuePullRequestChip({
  pullRequest,
}: {
  pullRequest: SeerAgenticTriageRunPullRequest;
}) {
  const status = pullRequest.status ?? 'unknown';
  const Icon = PR_STATUS_ICON[status] ?? IconPullRequest;
  // The chip stays compact -- just the PR number (and its status when notable);
  // the full title would blow out the row, so it lives on hover instead.
  const number = `#${pullRequest.id}`;
  const label = PR_STATUS_PREFIXED.has(status)
    ? `${getPullRequestStatusLabel(status)} ${number}`
    : number;
  const tooltipTitle = pullRequest.title ?? t('Pull request #%s', pullRequest.id);
  const chip = pullRequest.externalUrl ? (
    <LinkButton size="xs" icon={<Icon />} href={pullRequest.externalUrl} external>
      {label}
    </LinkButton>
  ) : (
    <Tag variant="muted" icon={<Icon />}>
      {label}
    </Tag>
  );
  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      {chip}
    </Tooltip>
  );
}

function TriageIssuesDebugAddendum({run}: {run: SeerAgenticTriageRun}) {
  const issues = run.issues ?? [];
  if (issues.length === 0) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Per-issue internals')}
      </Text>
      <Grid
        columns="max-content max-content max-content max-content max-content"
        gap="sm xl"
        align="center"
      >
        <Text bold size="xs" variant="muted">
          {t('Group')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Raw action')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Skip reason')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Seer Run ID')}
        </Text>
        <span />
        {issues.flatMap(issue => [
          <Text key={`${issue.id}-group`} size="sm" monospace>
            {issue.groupId}
          </Text>,
          <Text key={`${issue.id}-action`} size="sm" monospace>
            {issue.action}
          </Text>,
          <Text key={`${issue.id}-skip-reason`} size="sm" variant="muted" monospace>
            {issue.skipReason ?? '-'}
          </Text>,
          <Text key={`${issue.id}-seer`} size="sm" variant="muted" monospace>
            {issue.seerRunId ?? '-'}
          </Text>,
          issue.seerRunId === null ? (
            <span key={`${issue.id}-explorer`} />
          ) : (
            <LinkButton
              key={`${issue.id}-explorer`}
              size="xs"
              icon={<IconOpen />}
              to={getRelativeExplorerUrl(issue.seerRunId)}
            >
              {t('Explorer')}
            </LinkButton>
          ),
        ])}
      </Grid>
    </Stack>
  );
}

function getTriageErrorPresentation(
  errorType: SeerAgenticTriageRunErrorType | null
): {resultText: string; status: WorkflowDisplayStatus} | null {
  switch (errorType) {
    case null:
      return null;
    case 'no_quota':
      return {status: 'skipped', resultText: t('No Seer quota available')};
    case 'no_seer_access':
      return {status: 'skipped', resultText: t('Seer is not enabled')};
    case 'eligible_projects_failed':
      return {status: 'failed', resultText: t('Could not check eligible projects')};
    case 'invalid_shard_plan':
      return {status: 'failed', resultText: t('Could not prepare triage')};
    case 'shard_dispatch_failed':
      return {status: 'failed', resultText: t('Could not start all triage batches')};
    default:
      return {status: 'failed', resultText: t('Run failed')};
  }
}

function getTriageRunIds(run: SeerAgenticTriageRun): string[] {
  return (run.seerRuns ?? [])
    .map(seerRun => seerRun.seerRunId)
    .filter((id): id is string => id !== null);
}

// Maps raw triage action enum values to human-readable labels for the
// user-facing issue list. Falls back to the raw value for unknown verbs.
const ACTION_LABELS: Record<string, string> = {
  autofix: 'Autofix queued',
  autofix_triggered: 'Autofix queued',
  root_cause_only: 'Root cause analysis',
  skip: 'Skipped',
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
