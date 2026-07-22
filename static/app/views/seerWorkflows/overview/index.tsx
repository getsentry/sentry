import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
import {IconArrow, IconChevron, IconGrid, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {DEFAULT_STATS_PERIOD, PERIOD_FILTER_OPTIONS} from './periods';
import {SectionIssueCard} from './sectionIssueCard';
import {STATUS_GROUP_META, StatusGroupTooltip, type StatusGroupKey} from './statusGroups';
import {
  SECTION_ORDER,
  useAutofixSections,
  type OverviewIssue,
} from './useAutofixSections';

type SortValue = 'activity' | 'events';
type OverviewView = 'cards' | 'table';

const SORT_OPTIONS: Array<{label: string; value: SortValue}> = [
  {value: 'activity', label: t('Recent activity')},
  {value: 'events', label: t('Most events')},
];

export default function AutofixOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  // Deep-link focus mode: ?id=<issueId> renders exactly that issue's card,
  // fully expanded, fetched by group id so it resolves even outside the
  // list's filters.
  const selectedId = decodeScalar(location.query.id);
  const period = decodeScalar(location.query.period) ?? DEFAULT_STATS_PERIOD;
  // Unknown or legacy sort values fall back to the default.
  const sort = decodeScalar(location.query.sort) === 'events' ? 'events' : 'activity';

  // Project scoping comes from the canonical page-filters selection; the
  // section requests are gated until the persisted selection is restored so
  // the first fetch doesn't race it with an all-projects query.
  const {selection, isReady: pageFiltersReady} = usePageFilters();

  const {sections, isPending, isError, refetch} = useAutofixSections({
    enabled: pageFiltersReady && !selectedId,
    projects: selection.projects,
    sort: sort === 'events' ? 'freq' : 'date',
    statsPeriod: period,
  });

  const pinnedIssueQuery = useQuery({
    ...apiOptions.as<OverviewIssue[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {group: [selectedId ?? ''], project: -1, statsPeriod: period},
      staleTime: 30_000,
    }),
    enabled: Boolean(selectedId),
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

  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview:collapsed-groups',
    []
  );
  const [view, setView] = useLocalStorageState<OverviewView>(
    'seer-autofix-overview:view',
    storedValue => (storedValue === 'table' ? 'table' : 'cards')
  );
  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };
  const allGroupsCollapsed = SECTION_ORDER.every(key => collapsedGroups.includes(key));

  const firstLoad = isPending && sections.every(section => section.isPending);
  const allSectionsEmpty = sections.every(
    section => !section.isPending && section.issues.length === 0
  );
  const pinnedIssues = pinnedIssueQuery.data ?? [];

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <PageFiltersContainer>
        <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
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
              <Flex justify="between" align="center" gap="md" wrap="wrap">
                <Flex gap="md" align="center" wrap="wrap">
                  <PageFilterBar condensed>
                    <ProjectPageFilter />
                  </PageFilterBar>
                  <CompactSelect
                    value={period}
                    options={PERIOD_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        period:
                          selected.value === DEFAULT_STATS_PERIOD
                            ? undefined
                            : String(selected.value),
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
                <Flex gap="xl" align="center">
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
                      setCollapsedGroups(allGroupsCollapsed ? [] : [...SECTION_ORDER])
                    }
                  >
                    {allGroupsCollapsed ? t('Expand all') : t('Collapse all')}
                  </Button>
                  <SegmentedControl<OverviewView>
                    size="xs"
                    value={view}
                    onChange={setView}
                    aria-label={t('View mode')}
                  >
                    <SegmentedControl.Item
                      key="cards"
                      icon={<IconGrid />}
                      aria-label={t('Card view')}
                      tooltip={t('Card view')}
                    />
                    <SegmentedControl.Item
                      key="table"
                      icon={<IconTable />}
                      aria-label={t('Table view')}
                      tooltip={t('Table view')}
                    />
                  </SegmentedControl>
                </Flex>
              </Flex>
            )}

            {selectedId ? (
              pinnedIssueQuery.isError ? (
                <LoadingError onRetry={pinnedIssueQuery.refetch} />
              ) : pinnedIssueQuery.isPending ? (
                <LoadingIndicator />
              ) : pinnedIssues.length === 0 ? (
                <Container border="primary" radius="md" padding="xl">
                  <Text as="p" variant="muted" align="center">
                    {t('Issue not found.')}
                  </Text>
                </Container>
              ) : (
                <Stack gap="md">
                  {pinnedIssues.map(issue => (
                    <SectionIssueCard
                      key={issue.id}
                      issue={issue}
                      orgSlug={organization.slug}
                      view="cards"
                      statsPeriod={period}
                      defaultExpanded
                      lazy={false}
                    />
                  ))}
                </Stack>
              )
            ) : isError ? (
              <LoadingError onRetry={refetch} />
            ) : firstLoad ? (
              <LoadingIndicator />
            ) : allSectionsEmpty ? (
              <Container border="primary" radius="md" padding="xl">
                <Text as="p" variant="muted" align="center">
                  {t('No completed autofix runs yet.')}
                </Text>
              </Container>
            ) : (
              <Stack gap="lg">
                {sections.map(section => {
                  const meta = STATUS_GROUP_META[section.key];
                  return (
                    <StatusGroup
                      key={section.key}
                      size="sm"
                      expanded={!collapsedGroups.includes(section.key)}
                      onExpandedChange={next => toggleGroup(section.key, next)}
                    >
                      <GroupHeader>
                        <Disclosure.Title>
                          <Flex gap="sm" align="center">
                            <Tooltip
                              title={<StatusGroupTooltip groupKey={section.key} />}
                              skipWrapper
                            >
                              <meta.Icon size="sm" aria-hidden />
                            </Tooltip>
                            <Text bold>{meta.label}</Text>
                            <Badge variant="muted">{section.count ?? '…'}</Badge>
                          </Flex>
                        </Disclosure.Title>
                      </GroupHeader>
                      <Disclosure.Content>
                        {section.isError ? (
                          <LoadingError onRetry={section.refetch} />
                        ) : section.isPending ? (
                          <LoadingIndicator />
                        ) : section.issues.length === 0 ? (
                          <Container padding="md">
                            <Text as="p" variant="muted" size="sm">
                              {t('No issues')}
                            </Text>
                          </Container>
                        ) : (
                          <Stack gap={view === 'cards' ? 'md' : '0'} paddingTop="sm">
                            {section.issues.map((issue, index) => (
                              <SectionIssueCard
                                key={issue.id}
                                issue={issue}
                                orgSlug={organization.slug}
                                view={view}
                                statsPeriod={period}
                                isLast={index === section.issues.length - 1}
                              />
                            ))}
                          </Stack>
                        )}
                      </Disclosure.Content>
                    </StatusGroup>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </Feature>
  );
}

// Disclosure.Content hardcodes a padding-left to indent its panel under the
// title; the `> * + *` sibling selector drops it so the full-width cards line
// up flush with their group header.
const StatusGroup = styled(Disclosure)`
  && > * + * {
    padding-left: 0;
  }
`;

// Sticky group header; z-index isn't a layout-primitive prop so it lives here.
// Opaque background so cards scroll under it.
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
