import {type ComponentProps, Fragment, useMemo} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {orgNeedsSeerTrial} from 'sentry/utils/seer/orgNeedsSeerTrial';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

import {AssigneeFilter, matchesAssignee} from './assigneeFilter';
import {OverviewCard} from './issueCard';
import {useMilestoneAdvanceToasts} from './milestoneToast';
import {OverviewSkeleton, ProjectFilterSkeleton} from './overviewSkeleton';
import {ProjectSetupWarning} from './projectSetupWarning';
import {
  GroupHeader,
  STATUS_GROUP_META,
  StatusGroup,
  type StatusGroupKey,
  StatusGroupTooltip,
} from './statusGroups';
import {OVERVIEW_SECTIONS, type OverviewRun, type OverviewSort} from './types';
import {useAutofixOverview} from './useAutofixOverview';
import {useOverviewAnalytics} from './useOverviewAnalytics';
import {useOverviewSeerDrawer} from './useOverviewSeerDrawer';

const SeerTrialCTA = OverrideOrDefault({
  overrideName: 'component:seer-trial-cta',
});

const SORT_OPTIONS: Array<{label: string; value: OverviewSort}> = [
  {value: 'seer', label: t('Recent Seer Activity')},
  {value: 'issue', label: t('Recent Issue Activity')},
  {value: 'events', label: t('Most events')},
  {value: 'users', label: t('Most users')},
];

// Buckets the assignee filter value (a raw `type:id` actor string) for
// analytics, avoiding actor-id PII/cardinality. Null means the filter was
// cleared back to all assignees.
function bucketAssignee(value: string | null, currentUserId: string): string {
  if (!value) {
    return 'all';
  }
  if (value === 'unassigned') {
    return 'unassigned';
  }
  const [type, id] = value.split(':');
  if (type === 'team') {
    return 'team';
  }
  return id === currentUserId ? 'me' : 'user';
}

export default function AutofixOverview() {
  const organization = useOrganization();

  return (
    <Feature
      organization={organization}
      features="seer-night-shift-ui"
      renderDisabled={() => <NoAccess />}
    >
      <PageFiltersContainer
        defaultSelection={{
          datetime: {period: '7d', start: null, end: null, utc: null},
        }}
      >
        <SentryDocumentTitle title={t('Autofix Overview')} orgSlug={organization.slug}>
          <Layout.Title>{t('Autofix Overview')}</Layout.Title>
          {orgNeedsSeerTrial(organization) ? (
            <Stack gap="lg" padding="lg xl">
              <SeerTrialCTA />
            </Stack>
          ) : (
            <AutofixOverviewContent organization={organization} />
          )}
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </Feature>
  );
}

// Owns every request so a feature-disabled org mounts no query at all.
function AutofixOverviewContent({organization}: {organization: Organization}) {
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const {initiallyLoaded: projectsLoaded} = useProjects();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  useOverviewSeerDrawer();
  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview:collapsed-groups',
    []
  );

  const sort: OverviewSort =
    SORT_OPTIONS.find(option => option.value === decodeScalar(location.query.sort))
      ?.value ?? 'seer';
  const assignee = decodeScalar(location.query.assignee) ?? null;
  const view =
    decodeScalar(location.query.view) === 'in_progress' ? 'in_progress' : 'all';

  const setQueryParam = (key: string, value: string | undefined) =>
    navigate(
      {
        pathname: location.pathname,
        query: {...location.query, [key]: value},
      },
      {replace: true}
    );

  const trackFilterChanged = (
    filterType: 'sort' | 'assignee' | 'activity' | 'view_tab',
    value: string
  ) =>
    trackAnalytics('autofix.overview.filter_changed', {
      organization,
      filter_type: filterType,
      value,
    });

  const {
    data,
    projectConfig,
    projectConfigPending,
    isPending,
    isError,
    enrichmentPending,
    refetch,
    enrichedSettled,
  } = useAutofixOverview({
    organization,
    selection,
    sort,
    enabled: pageFiltersReady,
  });
  useMilestoneAdvanceToasts(data, enrichedSettled);
  const unconfiguredProjects =
    projectConfig?.filter(project => !project.hasReposConnected) ?? [];
  useOverviewAnalytics({
    data,
    isPending,
    numProjectsSelected: selection.projects.length,
    numUnconfiguredProjects: unconfiguredProjects.length,
    projectConfigPending,
    statsPeriod: selection.datetime.period,
  });
  const allUnconfigured =
    unconfiguredProjects.length > 0 &&
    unconfiguredProjects.length === projectConfig?.length;
  const someUnconfigured = unconfiguredProjects.length > 0 && !allUnconfigured;
  const allRuns = useMemo(
    () => Object.values(data?.runsByMilestone ?? {}).flat(),
    [data]
  );
  const passesAssignee = (run: OverviewRun) =>
    assignee === null || matchesAssignee(run, assignee);
  const assigneeRuns = allRuns.filter(passesAssignee);
  // "In Progress" means the agent is actively working — the same definition as
  // the card spinner, so a run awaiting user input is intentionally excluded.
  const inProgressCount = assigneeRuns.filter(run => run.status === 'processing').length;
  const populatedSections = OVERVIEW_SECTIONS.map(section => ({
    ...section,
    runs: (data?.runsByMilestone[section.milestone] ?? []).filter(
      run => passesAssignee(run) && (view === 'all' || run.status === 'processing')
    ),
  })).filter(section => section.runs.length > 0);

  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };

  const resultsPending = isPending || projectConfigPending;
  const populatedKeys = populatedSections.map(section => section.key);
  const allCollapsed =
    populatedKeys.length > 0 && populatedKeys.every(key => collapsedGroups.includes(key));

  const toggleAllGroups = () => {
    setCollapsedGroups(previous =>
      allCollapsed
        ? previous.filter(key => !populatedKeys.includes(key))
        : [...new Set([...previous, ...populatedKeys])]
    );
  };

  let noRunsContent: React.ReactNode;
  if (allUnconfigured) {
    noRunsContent = (
      <EmptyState
        padding="3xl"
        title={t('Set up Seer to start fixing issues')}
        description={t(
          'None of your selected projects have a repository connected. Connect one so Seer can start working on your issues.'
        )}
        action={
          <LinkButton variant="primary" to={`/settings/${organization.slug}/seer/`}>
            {t('Set up Seer')}
          </LinkButton>
        }
      />
    );
  } else {
    noRunsContent = <EmptyState padding="3xl" title={t('No Autofix runs')} />;
  }

  return (
    <Stack gap="lg" padding="lg xl">
      <Flex gap="md" align="center" wrap="wrap">
        {pageFiltersReady && projectsLoaded ? (
          <PageFilterBar condensed>
            <ProjectPageFilter />
          </PageFilterBar>
        ) : (
          <ProjectFilterSkeleton />
        )}
        <DatePageFilter
          onChange={update =>
            trackFilterChanged('activity', update.relative ?? 'absolute')
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Autofix Activity')} />
          )}
        />
        <AssigneeFilter
          runs={allRuns}
          value={assignee}
          onChange={next => {
            trackFilterChanged('assignee', bucketAssignee(next, user.id));
            setQueryParam('assignee', next ?? undefined);
          }}
          loading={isPending}
        />
        <CompactSelect
          value={sort}
          options={SORT_OPTIONS}
          onChange={selected => {
            trackFilterChanged('sort', selected.value);
            setQueryParam('sort', selected.value === 'seer' ? undefined : selected.value);
          }}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Sort')} />
          )}
        />
        {(data?.truncatedMilestones?.length ?? 0) > 0 && (
          <Text size="sm" variant="muted">
            {t(
              'Some sections show only their most recent runs, so assignee options and counts may be incomplete.'
            )}
          </Text>
        )}
        <Flex marginLeft="auto">
          <Button
            onClick={toggleAllGroups}
            disabled={!resultsPending && populatedSections.length === 0}
          >
            {allCollapsed ? t('Expand All') : t('Collapse All')}
          </Button>
        </Flex>
      </Flex>
      {isError ? (
        <LoadingError onRetry={refetch} />
      ) : resultsPending ? (
        <OverviewSkeleton />
      ) : (
        <Fragment>
          {someUnconfigured && (
            <ProjectSetupWarning
              unconfiguredProjects={unconfiguredProjects}
              orgSlug={organization.slug}
            />
          )}
          {allRuns.length === 0 ? (
            noRunsContent
          ) : assigneeRuns.length === 0 ? (
            <EmptyState
              padding="3xl"
              title={t('No Autofix runs match the selected assignee.')}
            />
          ) : (
            <Fragment>
              <Tabs
                value={view}
                onChange={next => {
                  trackFilterChanged('view_tab', next);
                  setQueryParam('view', next === 'all' ? undefined : next);
                }}
              >
                <TabList>
                  <TabList.Item key="all">
                    {t('All Runs (%s)', assigneeRuns.length)}
                  </TabList.Item>
                  <TabList.Item key="in_progress">
                    {t('In Progress (%s)', inProgressCount)}
                  </TabList.Item>
                </TabList>
              </Tabs>
              {populatedSections.length === 0 ? (
                <EmptyState
                  padding="3xl"
                  title={t('No Autofix runs are currently in progress.')}
                />
              ) : (
                <OverviewSectionList
                  sections={populatedSections}
                  collapsedGroups={collapsedGroups}
                  onToggle={toggleGroup}
                  orgSlug={organization.slug}
                  statsPeriod={selection.datetime.period}
                  enrichmentPending={enrichmentPending}
                />
              )}
            </Fragment>
          )}
        </Fragment>
      )}
    </Stack>
  );
}

function OverviewSectionList({
  sections,
  collapsedGroups,
  onToggle,
  orgSlug,
  statsPeriod,
  enrichmentPending,
}: {
  collapsedGroups: StatusGroupKey[];
  enrichmentPending: boolean;
  onToggle: (groupKey: StatusGroupKey, expanded: boolean) => void;
  orgSlug: string;
  sections: Array<(typeof OVERVIEW_SECTIONS)[number] & {runs: OverviewRun[]}>;
  statsPeriod: ComponentProps<typeof OverviewCard>['statsPeriod'];
}) {
  return (
    <Stack gap="lg">
      {sections.map(({key, runs}) => {
        const meta = STATUS_GROUP_META[key];
        const groupLabel = key === 'needs_investigation' ? t('Create Plan') : meta.label;
        const expanded = !collapsedGroups.includes(key);
        return (
          <StatusGroup
            key={key}
            size="sm"
            expanded={expanded}
            onExpandedChange={next => onToggle(key, next)}
          >
            <GroupHeader>
              <Disclosure.Title>
                <Flex gap="sm" align="center">
                  <Tooltip title={<StatusGroupTooltip groupKey={key} />} skipWrapper>
                    <meta.Icon size="sm" aria-hidden />
                  </Tooltip>
                  <Text bold>{groupLabel}</Text>
                  <Badge variant="muted">{runs.length}</Badge>
                </Flex>
              </Disclosure.Title>
            </GroupHeader>
            <Disclosure.Content>
              <Stack gap="md" paddingTop="sm">
                {runs.map(run => (
                  <OverviewCard
                    key={run.seerRunId}
                    run={run}
                    orgSlug={orgSlug}
                    sectionKey={key}
                    statsPeriod={statsPeriod}
                    enrichmentPending={enrichmentPending}
                  />
                ))}
              </Stack>
            </Disclosure.Content>
          </StatusGroup>
        );
      })}
    </Stack>
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
