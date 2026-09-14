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
import type {PullRequest, PullRequestStatus} from 'sentry/types/integrations';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {TagVariant} from 'sentry/utils/theme';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';
import type {
  SeerWorkflowRun,
  WorkflowRow,
  WorkflowRowStatus,
  WorkflowRunStatus,
} from 'sentry/views/seerWorkflows/types';

type SeerNightShiftRunPullRequest = PullRequest & {
  status: PullRequestStatus | null;
};

type SeerNightShiftRunIssue = {
  action: string;
  dateAdded: string;
  groupId: string;
  groupShortId: string | null;
  groupTitle: string | null;
  id: string;
  reason: string | null;
  seerRunId: string | null;
  skipReason: string | null;
  pullRequests?: SeerNightShiftRunPullRequest[];
};

// A Seer run dispatched by a night shift run, openable in Explorer.
type SeerNightShiftSeerRun = {
  seerRunId: string | null;
};

type SeerNightShiftRunOptions = {
  dry_run?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  source?: string;
};

type SeerNightShiftRunExtras = {
  coverage?: {
    complete: number;
    failed: number;
    partial: number;
    total: number;
  };
  options?: SeerNightShiftRunOptions;
  status?: WorkflowRunStatus;
  target_project_ids?: number[];
  triggering_user_id?: number;
};

type SeerNightShiftRunErrorType =
  | 'no_quota'
  | 'eligible_projects_failed'
  | 'no_seer_access'
  | 'invalid_shard_plan'
  | 'shard_dispatch_failed'
  | 'shard_delivery_failed'
  | 'unknown';

type SeerNightShiftRun = SeerWorkflowRun & {
  errorType: SeerNightShiftRunErrorType | null;
  extras: SeerNightShiftRunExtras;
  issues: SeerNightShiftRunIssue[];
  seerRuns: SeerNightShiftSeerRun[];
  strategy: 'agentic_triage';
};

export type NightShiftRow = {
  issues: SeerNightShiftRunIssue[];
  seerRuns: SeerNightShiftSeerRun[];
  options?: SeerNightShiftRunOptions;
};

export function getNightShiftRow(run: SeerWorkflowRun) {
  if (!isNightShiftRun(run)) {
    return {};
  }
  const errorPresentation = getTriageErrorPresentation(run.errorType ?? null);
  return {
    ...errorPresentation,
    source: run.extras.options?.source,
    triage: {
      options: run.extras.options,
      issues: run.issues,
      seerRuns: run.seerRuns ?? [],
    },
  };
}

export function NightShiftSummary({row}: {row: WorkflowRow}) {
  if (row.status === 'running') {
    return <Text size="sm">{t('Triaging issues…')}</Text>;
  }
  if (row.resultText || row.status === 'failed') {
    return (
      <Text size="sm" variant={row.status === 'failed' ? 'danger' : 'primary'}>
        {row.resultText ?? t('Run failed')}
      </Text>
    );
  }
  const triage = row.triage;
  if (triage?.options?.dry_run) {
    return (
      <Text variant="muted" size="sm">
        {t('dry run')}
      </Text>
    );
  }
  const issueCount = triage?.issues.length ?? 0;
  if (issueCount === 0) {
    return (
      <Text variant="muted" size="sm">
        {t('No issues processed')}
      </Text>
    );
  }
  return <Text size="sm">{tn('%s issue', '%s issues', issueCount)}</Text>;
}

export function NightShiftResults({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  return (
    <Stack gap="lg">
      {row.summary ? (
        <Text as="p" size="md">
          {row.summary}
        </Text>
      ) : null}
      <TriageDispatchesPanel row={row} />
      <IssueList issues={row.triage?.issues ?? []} organizationSlug={organizationSlug} />
    </Stack>
  );
}

export function NightShiftDebug({row}: {row: WorkflowRow}) {
  const {
    reasoning_effort,
    intelligence_level,
    extra_triage_instructions,
    max_candidates,
  } = row.triage?.options ?? {};
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
          {row.runId}
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
      {row.errorMessage ? (
        <Text variant="danger" size="sm" monospace>
          {t('Error: ')}
          {row.errorMessage}
        </Text>
      ) : null}
      <TriageIssuesDebugAddendum row={row} />
    </Stack>
  );
}

function TriageDispatchesPanel({row}: {row: WorkflowRow}) {
  const explorerRunIds = getTriageRunIds(row);
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Triage batches (%s)', explorerRunIds.length)}
      </Text>
      {explorerRunIds.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No triage batches recorded for this run.')}
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
}: {
  issues: SeerNightShiftRunIssue[];
  organizationSlug: string;
}) {
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Issues (%s)', issues.length)}
      </Text>

      {issues.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No issues processed in this run.')}
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
  issue: SeerNightShiftRunIssue;
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

function IssueStatusTag({issue}: {issue: SeerNightShiftRunIssue}) {
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
  pullRequest: SeerNightShiftRunPullRequest;
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

function TriageIssuesDebugAddendum({row}: {row: WorkflowRow}) {
  const issues = row.triage?.issues ?? [];
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
  errorType: SeerNightShiftRunErrorType | null
): {resultText: string; status: WorkflowRowStatus} | null {
  switch (errorType) {
    case null:
      return null;
    case 'no_quota':
      return {status: 'skipped', resultText: t('No Seer quota available')};
    case 'no_seer_access':
      return {status: 'skipped', resultText: t('Seer is not enabled')};
    case 'eligible_projects_failed':
      return {
        status: 'failed',
        resultText: t('Could not check eligible projects'),
      };
    case 'invalid_shard_plan':
      return {status: 'failed', resultText: t('Could not prepare triage')};
    case 'shard_dispatch_failed':
      return {
        status: 'failed',
        resultText: t('Could not start all triage batches'),
      };
    default:
      return {status: 'failed', resultText: t('Run failed')};
  }
}

function getTriageRunIds(row: WorkflowRow): string[] {
  return (row.triage?.seerRuns ?? [])
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

// Night Shift still supplies issue and dispatch fields alongside the shared envelope.
function isNightShiftRun(run: SeerWorkflowRun): run is SeerNightShiftRun {
  return run.strategy === 'agentic_triage';
}
