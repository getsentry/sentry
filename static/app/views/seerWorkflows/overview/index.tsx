import {useMemo} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
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
  // Deep-link focus mode: ?id=<issueId> renders exactly that issue's card,
  // fully expanded, fetched by group id so it resolves even outside the
  // list's filters and pagination.
  const selectedId = decodeScalar(location.query.id);
  const outcomeFilter = decodeList(location.query.outcome) as AutofixOutcome[];
  // TODO(seer): trigger filter disabled — see TRIGGER_FILTER_OPTIONS above.
  // const triggerFilter = decodeList(location.query.trigger) as AutofixTrigger[];
  const attentionFilter = decodeList(location.query.attention) as AttentionReason[];
  const period = decodeScalar(location.query.period);
  const sort = (decodeScalar(location.query.sort) as SortValue | undefined) ?? 'triage';

  // Project scoping comes from the canonical page-filters selection; the
  // issues request is gated until the persisted selection is restored so the
  // first fetch doesn't race it with an all-projects query.
  const {selection, isReady: pageFiltersReady} = usePageFilters();

  const {issues, isPending, isError, refetch, pageLinks} = useAutofixIssues({
    query: '',
    cursor,
    enabled: pageFiltersReady,
    groupIds: selectedId ? [selectedId] : undefined,
    projects: selection.projects,
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

  // Focus mode shows the fetched issue as-is — client-side filters and sort
  // don't apply to a single deep-linked card.
  const visibleRows = selectedId ? rowsWithAttention : sortedRows;

  const hasActiveFilters =
    outcomeFilter.length > 0 ||
    attentionFilter.length > 0 ||
    (period !== undefined && period !== '');

  const clearAllFilters = () => {
    updateQuery({
      outcome: undefined,
      attention: undefined,
      period: undefined,
    });
  };

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <PageFiltersContainer>
        <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
          {/* The title lives in the app's slim top bar (Layout.Title fills the
              TopBar slot); the description rides along as its info tip. */}
          <Layout.Title>
            {t('Autofix Overview')}
            <InfoTip
              position="right"
              size="sm"
              title={t(
                'Issues where Autofix has produced a root cause, solution, code changes, or pull request.'
              )}
            />
          </Layout.Title>
          <Stack gap="lg" padding="lg xl">
            {/* Focus mode swaps the filter toolbar for a way back to the
                list; every other param (project, sort, ...) is preserved. */}
            {selectedId ? (
              <Flex>
                <LinkButton
                  size="xs"
                  variant="transparent"
                  icon={<IconArrow direction="left" size="xs" />}
                  to={{
                    pathname: location.pathname,
                    query: {...location.query, id: undefined},
                  }}
                >
                  {t('All issues')}
                </LinkButton>
              </Flex>
            ) : (
              // Filters first, unboxed, matching the issue stream's layout:
              // server-side scope, then the client-side filters
              <Flex justify="between" align="center" gap="md" wrap="wrap">
                <Flex gap="md" align="center" wrap="wrap">
                  <PageFilterBar condensed>
                    <ProjectPageFilter resetParamsOnChange={['cursor']} />
                  </PageFilterBar>
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
            )}

            {isError ? (
              <LoadingError onRetry={refetch} />
            ) : isPending ? (
              <LoadingIndicator />
            ) : visibleRows.length === 0 ? (
              <Container border="primary" radius="md" padding="xl">
                <Text as="p" variant="muted" align="center">
                  {selectedId
                    ? t('Issue not found.')
                    : hasActiveFilters
                      ? t('No issues match your filters.')
                      : t('No completed autofix runs yet.')}
                </Text>
              </Container>
            ) : (
              <Stack gap="md">
                {visibleRows.map(({row}) => (
                  <IssueCard
                    key={row.id}
                    row={row}
                    orgSlug={organization.slug}
                    defaultExpanded={Boolean(selectedId)}
                  />
                ))}
              </Stack>
            )}

            {!selectedId && !isPending && !isError && (
              <Pagination pageLinks={pageLinks} />
            )}
          </Stack>
        </SentryDocumentTitle>
      </PageFiltersContainer>
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
