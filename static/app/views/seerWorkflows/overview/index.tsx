import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
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
import {Sticky} from 'sentry/components/sticky';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAutofixIssues} from 'sentry/views/autofixIssuesDemo/useAutofixIssues';

import {ATTENTION_META, ATTENTION_REASONS, getAttentionReason} from './attentionBadge';
import {buildOverviewRows} from './buildOverviewRows';
import {IssueCard} from './issueCard';
import {RUN_QUESTION_PROMPTS} from './runQuestions';
import {
  getStatusGroup,
  STATUS_GROUP_META,
  STATUS_GROUP_ORDER,
  type StatusGroupKey,
} from './statusGroups';
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

// Urgency ordering lives in the status groups now; the sort only orders
// cards within each group.
type SortValue = 'activity' | 'events';

const SORT_OPTIONS: Array<{label: string; value: SortValue}> = [
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
  // Legacy ?sort=triage (and anything unknown) decodes to the default.
  const sort = decodeScalar(location.query.sort) === 'events' ? 'events' : 'activity';

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
        // Every caller changes a filter or the sort, where a stale cursor
        // from a previous page makes no sense — reset it (the project filter
        // already does the same via resetParamsOnChange).
        query: {...location.query, cursor: undefined, ...patch},
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

  // The sort orders cards within each status group; the groups themselves
  // are fixed in triage order.
  const byActivity = (
    a: (typeof filteredRows)[number],
    b: (typeof filteredRows)[number]
  ) => Date.parse(b.row.lastActivityAt) - Date.parse(a.row.lastActivityAt);
  const sortedRows = [...filteredRows].sort((a, b) =>
    sort === 'events'
      ? b.row.eventCount - a.row.eventCount || byActivity(a, b)
      : byActivity(a, b)
  );

  // Focus mode shows the fetched issue as-is — client-side filters, sort,
  // and grouping don't apply to a single deep-linked card.
  const visibleRows = selectedId ? rowsWithAttention : sortedRows;

  // Linear-style sections in fixed triage order; empty groups don't render.
  const groupedRows = STATUS_GROUP_ORDER.map(
    groupKey =>
      [
        groupKey,
        sortedRows.filter(
          ({row, attention}) => getStatusGroup(row, attention) === groupKey
        ),
      ] as const
  ).filter(([, rows]) => rows.length > 0);

  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview:collapsed-groups',
    []
  );
  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };
  const allGroupsCollapsed =
    groupedRows.length > 0 &&
    groupedRows.every(([groupKey]) => collapsedGroups.includes(groupKey));

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
                          selected.value === 'activity'
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
                <Flex gap="sm" align="center">
                  {hasActiveFilters ? (
                    <Button size="xs" variant="link" onClick={clearAllFilters}>
                      {t('Clear all')}
                    </Button>
                  ) : null}
                  {groupedRows.length > 0 && (
                    <Button
                      size="xs"
                      variant="link"
                      icon={
                        <IconChevron
                          isDouble
                          direction={allGroupsCollapsed ? 'down' : 'up'}
                          size="xs"
                        />
                      }
                      onClick={() =>
                        setCollapsedGroups(
                          allGroupsCollapsed
                            ? []
                            : groupedRows.map(([groupKey]) => groupKey)
                        )
                      }
                    >
                      {allGroupsCollapsed ? t('Expand all') : t('Collapse all')}
                    </Button>
                  )}
                </Flex>
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
            ) : selectedId ? (
              <Stack gap="md">
                {visibleRows.map(({row}) => (
                  <IssueCard
                    key={row.id}
                    row={row}
                    orgSlug={organization.slug}
                    defaultExpanded
                  />
                ))}
              </Stack>
            ) : (
              <Stack gap="lg">
                {groupedRows.map(([groupKey, rows]) => {
                  const meta = STATUS_GROUP_META[groupKey];
                  return (
                    <Disclosure
                      key={groupKey}
                      size="sm"
                      expanded={!collapsedGroups.includes(groupKey)}
                      onExpandedChange={next => toggleGroup(groupKey, next)}
                    >
                      <GroupHeader>
                        <Disclosure.Title>
                          <Flex gap="sm" align="center">
                            <meta.Icon size="sm" aria-hidden />
                            <Text bold>{meta.label}</Text>
                            <Badge variant="muted">{rows.length}</Badge>
                          </Flex>
                        </Disclosure.Title>
                      </GroupHeader>
                      <Disclosure.Content>
                        <Stack gap="md" paddingTop="sm">
                          {rows.map(({row}) => (
                            <IssueCard
                              key={row.id}
                              row={row}
                              orgSlug={organization.slug}
                            />
                          ))}
                        </Stack>
                      </Disclosure.Content>
                    </Disclosure>
                  );
                })}
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

// Linear-style section header: parks below the top bar while its group
// scrolls, then gets pushed away by the next header (sticky is bounded by
// its group's box). Opaque so cards slide underneath cleanly; z-index isn't
// a layout-primitive prop, hence the styled override.
const GroupHeader = styled(Sticky)`
  z-index: ${p => p.theme.zIndex.initial};
  width: 100%;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};

  &[data-stuck] {
    border-radius: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

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
