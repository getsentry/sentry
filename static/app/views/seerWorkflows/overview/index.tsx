import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconFilter, IconFix, IconMerge, IconPullRequest, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAutofixIssues} from 'sentry/views/autofixIssuesDemo/useAutofixIssues';

import {
  ATTENTION_META,
  ATTENTION_REASONS,
  getAttentionReason,
  getTriageRank,
} from './attentionBadge';
import {buildOverviewRows} from './buildOverviewRows';
import {IssueCard} from './issueCard';
import {RUN_QUESTION_PROMPTS} from './runQuestions';
import type {AttentionReason, AutofixOutcome} from './types';

// Only autofix runs. `source` is the run's origin surface (autofix, chat,
// night_shift orchestration, ...), not the autofix trigger — so this keeps
// autofixes (including night-shift-triggered ones, which are source=autofix)
// and drops non-autofix runs like the night-shift triage feature run. How the
// autofix was triggered lives in the run's referrer/auto_run_source, which the
// API doesn't expose yet; badging/filtering by it is a follow-up.
const OVERVIEW_RUNS_QUERY = 'type:explorer source:autofix';

const OUTCOME_FILTER_OPTIONS: Array<{label: string; value: AutofixOutcome}> = [
  {value: 'root_cause', label: t('Root cause')},
  {value: 'solution', label: t('Solution')},
  {value: 'code_changes', label: t('Code changes')},
  {value: 'pr_opened', label: t('PR opened')},
];

// TODO(seer): Re-enable the "Triggered by" filter once the backend exposes the
// autofix trigger. A run's `source` is its origin surface (always "autofix"
// here after the source:autofix filter), not how the autofix was triggered —
// that lives in the referrer / auto_run_source, which the runs API does not
// return yet. Until it does, this filter can only ever resolve to "manual", so
// it (and its options/parse/check/dropdown below) is disabled.
// const TRIGGER_FILTER_OPTIONS: Array<{label: string; value: AutofixTrigger}> =
//   SELECTABLE_TRIGGERS.map(value => ({
//     value,
//     label: TRIGGER_META[value].label,
//   }));

const ATTENTION_FILTER_OPTIONS: Array<{
  label: string;
  value: AttentionReason;
}> = ATTENTION_REASONS.map(value => ({
  value,
  label: ATTENTION_META[value].label,
}));

type QuickFilterValue = 'review_pr' | 'awaiting_input' | 'code_changes_ready' | 'merged';

type SortValue = 'triage' | 'activity' | 'events';

const SORT_OPTIONS: Array<{label: string; value: SortValue}> = [
  {value: 'triage', label: t('Needs you first')},
  {value: 'activity', label: t('Recent activity')},
  {value: 'events', label: t('Most events')},
];

const PERIOD_FILTER_OPTIONS: Array<{label: string; value: string}> = [
  {value: '', label: t('All time')},
  {value: '24h', label: t('Last 24 hours')},
  {value: '7d', label: t('Last 7 days')},
  {value: '30d', label: t('Last 30 days')},
];

const PERIOD_TO_DAYS: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export default function AutofixOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const cursor = decodeScalar(location.query.cursor);
  const outcomeFilter = decodeList(location.query.outcome) as AutofixOutcome[];
  // TODO(seer): trigger filter disabled — see TRIGGER_FILTER_OPTIONS above.
  // const triggerFilter = decodeList(location.query.trigger) as AutofixTrigger[];
  const attentionFilter = decodeList(location.query.attention) as AttentionReason[];
  const quickFilter = decodeScalar(location.query.quick) as QuickFilterValue | undefined;
  const period = decodeScalar(location.query.period);
  const sort = (decodeScalar(location.query.sort) as SortValue | undefined) ?? 'triage';

  const {issues, isPending, isError, refetch, pageLinks} = useAutofixIssues({
    query: '',
    cursor,
    runsQuery: OVERVIEW_RUNS_QUERY,
    questions: RUN_QUESTION_PROMPTS,
  });

  const updateQuery = (patch: Record<string, string | string[] | undefined>) => {
    navigate(
      {
        pathname: location.pathname,
        query: {...location.query, ...patch},
      },
      {replace: true}
    );
  };

  const toggleQuickFilter = (value: QuickFilterValue) => {
    updateQuery({quick: quickFilter === value ? undefined : value});
  };

  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : Date.now() - days * 24 * 60 * 60 * 1000;
  }, [period]);

  // Computed each render (not memoized): the hook's enriched issues array is a
  // new reference every render and there is at most a page's worth of rows.
  const rowsWithAttention = buildOverviewRows(issues).map(row => ({
    row,
    attention: getAttentionReason(row),
  }));

  const filteredRows = rowsWithAttention.filter(({row, attention}) => {
    if (outcomeFilter.length && !outcomeFilter.every(o => row.outcomes.includes(o))) {
      return false;
    }
    // TODO(seer): trigger filter disabled — see TRIGGER_FILTER_OPTIONS above.
    // if (triggerFilter.length && (!row.trigger || !triggerFilter.includes(row.trigger))) {
    //   return false;
    // }
    if (attentionFilter.length) {
      if (!attention || !attentionFilter.includes(attention)) {
        return false;
      }
    }
    if (quickFilter === 'merged') {
      if (!row.prMerged) {
        return false;
      }
    } else if (quickFilter && attention !== quickFilter) {
      return false;
    }
    if (periodCutoffMs !== null && Date.parse(row.lastActivityAt) < periodCutoffMs) {
      return false;
    }
    return true;
  });

  // Default is the triage-queue order, what needs a human first
  // (by urgency tier), highest impact within a tier, run recency as
  // the tiebreak.
  const byActivity = (
    a: (typeof filteredRows)[number],
    b: (typeof filteredRows)[number]
  ) => Date.parse(b.row.lastActivityAt) - Date.parse(a.row.lastActivityAt);
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sort === 'activity') {
      return byActivity(a, b);
    }
    if (sort === 'events') {
      return b.row.eventCount - a.row.eventCount || byActivity(a, b);
    }
    return (
      getTriageRank(a.row, a.attention) - getTriageRank(b.row, b.attention) ||
      b.row.eventCount - a.row.eventCount ||
      byActivity(a, b)
    );
  });

  const stats = {
    reviewPr: 0,
    awaitingInput: 0,
    codeChangesReady: 0,
    merged: 0,
  };
  for (const {row, attention} of filteredRows) {
    if (row.prMerged) {
      stats.merged++;
    }
    if (attention === 'review_pr') {
      stats.reviewPr++;
    }
    if (attention === 'awaiting_input') {
      stats.awaitingInput++;
    }
    if (attention === 'code_changes_ready') {
      stats.codeChangesReady++;
    }
  }

  const hasActiveFilters =
    outcomeFilter.length > 0 ||
    attentionFilter.length > 0 ||
    quickFilter !== undefined ||
    (period !== undefined && period !== '');

  const clearAllFilters = () => {
    updateQuery({
      outcome: undefined,
      attention: undefined,
      quick: undefined,
      period: undefined,
    });
  };

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
        <Stack gap="lg" padding="xl">
          <Flex justify="between" align="start" gap="md">
            <Stack gap="2xs">
              <Heading as="h1">{t('Autofix Overview')}</Heading>
              <Text as="p" variant="muted">
                {t(
                  'Issues where Autofix has produced a root cause, solution, code changes, or pull request.'
                )}
              </Text>
            </Stack>
            <Flex gap="sm" align="center">
              <LinkButton to={`/organizations/${organization.slug}/issues/autofix/`}>
                {t('Workflow runs')}
              </LinkButton>
              <LinkButton to={`/organizations/${organization.slug}/issues/autofix/runs/`}>
                {t('Runs demo')}
              </LinkButton>
            </Flex>
          </Flex>

          <Container width={{md: '100%', lg: '85%'}}>
            <Grid
              columns={{xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)'}}
              gap="md"
              marginBottom="md"
            >
              <StatCard
                Icon={IconUser}
                iconVariant="primary"
                label={t('Awaiting your input')}
                value={stats.awaitingInput}
                isActive={quickFilter === 'awaiting_input'}
                onClick={() => toggleQuickFilter('awaiting_input')}
              />
              <StatCard
                Icon={IconFix}
                iconVariant="secondary"
                label={t('Code changes ready')}
                value={stats.codeChangesReady}
                isActive={quickFilter === 'code_changes_ready'}
                onClick={() => toggleQuickFilter('code_changes_ready')}
              />
              <StatCard
                Icon={IconPullRequest}
                iconVariant="warning"
                label={t('Awaiting your review')}
                value={stats.reviewPr}
                isActive={quickFilter === 'review_pr'}
                onClick={() => toggleQuickFilter('review_pr')}
              />
              <StatCard
                Icon={IconMerge}
                iconVariant="success"
                label={t('Merged PRs')}
                value={stats.merged}
                isActive={quickFilter === 'merged'}
                onClick={() => toggleQuickFilter('merged')}
              />
            </Grid>
            <Container
              background="secondary"
              border="muted"
              radius="md"
              padding="sm md"
              marginBottom="md"
            >
              <Flex justify="between" align="center" gap="md" wrap="wrap">
                <Flex gap="md" align="center" wrap="wrap">
                  <IconFilter size="sm" variant="muted" aria-hidden />
                  <CompactSelect
                    multiple
                    value={outcomeFilter}
                    options={OUTCOME_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        outcome: selected.map(o => String(o.value)),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Outcome')}
                      />
                    )}
                  />
                  {/* TODO(seer): "Triggered by" filter disabled until the runs
                      API exposes the autofix trigger (referrer/auto_run_source);
                      see TRIGGER_FILTER_OPTIONS above.
                  <CompactSelect
                    multiple
                    value={triggerFilter}
                    options={TRIGGER_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        trigger: selected.map(o => String(o.value)),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Triggered by')}
                      />
                    )}
                  /> */}
                  <CompactSelect
                    multiple
                    value={attentionFilter}
                    options={ATTENTION_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        attention: selected.map(o => String(o.value)),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Needs attention')}
                      />
                    )}
                  />
                  <CompactSelect
                    value={period ?? ''}
                    options={PERIOD_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        period:
                          selected.value === '' ? undefined : String(selected.value),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Activity')}
                      />
                    )}
                  />
                  <CompactSelect
                    value={sort}
                    options={SORT_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        // Default sort keeps the URL clean.
                        sort:
                          selected.value === 'triage'
                            ? undefined
                            : String(selected.value),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Sort')}
                      />
                    )}
                  />
                </Flex>
                {hasActiveFilters ? (
                  <Button size="xs" variant="link" onClick={clearAllFilters}>
                    {t('Clear all')}
                  </Button>
                ) : null}
              </Flex>
            </Container>

            {isError ? (
              <LoadingError onRetry={refetch} />
            ) : isPending ? (
              <LoadingIndicator />
            ) : sortedRows.length === 0 ? (
              <Container border="primary" radius="md" padding="xl">
                <Text as="p" variant="muted" align="center">
                  {hasActiveFilters
                    ? t('No issues match your filters.')
                    : t('No completed autofix runs yet.')}
                </Text>
              </Container>
            ) : (
              <Stack gap="md">
                {sortedRows.map(({row}) => (
                  <IssueCard key={row.id} row={row} orgSlug={organization.slug} />
                ))}
              </Stack>
            )}

            {!isPending && !isError && <Pagination pageLinks={pageLinks} />}
          </Container>
        </Stack>
      </SentryDocumentTitle>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

type StatIconVariant = 'success' | 'warning' | 'primary' | 'secondary';

const StatCardButton = styled('button')<{isActive: boolean}>`
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  background: ${p =>
    p.isActive ? p.theme.tokens.background.secondary : p.theme.tokens.background.primary};
  border: 1px solid
    ${p => (p.isActive ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  &:hover {
    border-color: ${p =>
      p.disabled ? p.theme.tokens.border.primary : p.theme.tokens.border.accent};
  }
  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 1px;
  }
`;

function StatCard({
  Icon,
  iconVariant,
  label,
  value,
  isActive,
  onClick,
  extra,
}: {
  Icon: typeof IconUser;
  iconVariant: StatIconVariant;
  isActive: boolean;
  label: string;
  value: number | string;
  extra?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <StatCardButton
      type="button"
      isActive={isActive}
      aria-pressed={isActive}
      onClick={onClick}
      disabled={!onClick}
    >
      <Stack gap="xs">
        <Flex gap="xs" align="center">
          <Icon size="xs" variant={iconVariant} aria-hidden />
          <Text size="xs" variant="muted" uppercase>
            {label}
          </Text>
          {extra}
        </Flex>
        <Heading as="h2" size="2xl">
          {value}
        </Heading>
      </Stack>
    </StatCardButton>
  );
}
