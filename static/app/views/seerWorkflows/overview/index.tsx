import {Fragment, type ReactNode, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {TabList, Tabs} from '@sentry/scraps/tabs';

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
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconChevron, IconGrid, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {indexMembersByProject} from 'sentry/utils/members/shared';
import {decodeScalar} from 'sentry/utils/queryString';
import {orgNeedsSeerTrial} from 'sentry/utils/seer/orgNeedsSeerTrial';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';

import {AssigneeFilter, matchesAssignee} from './assigneeFilter';
import {OverviewCard} from './issueCard';
import {useMilestoneAdvanceToasts} from './milestoneToast';
import {OverviewSectionDisclosure} from './overviewShared';
import {OverviewSkeleton, ProjectFilterSkeleton} from './overviewSkeleton';
import {OverviewSectionTable, type OverviewSectionRendererProps} from './overviewTable';
import {ProjectSetupWarning} from './projectSetupWarning';
import {type StatusGroupKey} from './statusGroups';
import {
  OVERVIEW_SECTIONS,
  type OverviewRun,
  type OverviewSort,
  SCM_WINDOW_SIZE,
} from './types';
import {useAutofixOverview} from './useAutofixOverview';
import {useOverviewAnalytics} from './useOverviewAnalytics';
import {useOverviewSeerDrawer} from './useOverviewSeerDrawer';

const SeerTrialCTA = OverrideOrDefault({
  overrideName: 'component:seer-trial-cta',
});

const FilterBar = styled(Flex)`
  @container (width < ${p => p.theme.container.sm}) {
    > * {
      flex: 1 1 calc(50% - ${p => p.theme.space.md});
      min-width: 0;
    }

    > * > button {
      width: 100%;
      min-width: 0;
    }
  }
`;

const SORT_OPTIONS: Array<{label: string; value: OverviewSort}> = [
  {value: 'seer', label: t('Recent Seer Activity')},
  {value: 'issue', label: t('Recent Issue Activity')},
  {value: 'events', label: t('Most events')},
  {value: 'users', label: t('Most users')},
];

const {'90d': _90d, ...ACTIVITY_RELATIVE_PERIODS} = DEFAULT_RELATIVE_PERIODS;

const activityRelativeOptions = ({
  arbitraryOptions,
}: {
  arbitraryOptions: Record<string, ReactNode>;
}) => ({...ACTIVITY_RELATIVE_PERIODS, ...arbitraryOptions});

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
  const breakpoints = useBreakpoints();
  useOverviewSeerDrawer();
  const [collapsedGroups, setCollapsedGroups] = useLocalStorageState<StatusGroupKey[]>(
    'seer-autofix-overview:collapsed-groups',
    []
  );
  const [displayMode, setDisplayMode] = useLocalStorageState<'cards' | 'table'>(
    'seer-autofix-overview:display-mode',
    'cards'
  );
  // Table view is desktop-only; below the sm breakpoint we always fall back to
  // cards and hide the toggle.
  const canShowTable = breakpoints.sm;
  const displayModeEffective = canShowTable ? displayMode : 'cards';

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
    filterType: 'sort' | 'assignee' | 'activity' | 'view_tab' | 'display',
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
    issueStatsPending,
    isPending,
    isError,
    dataSettled,
    requestScmWindow,
    isScmSettled,
    isVitalsPending,
    refetch,
  } = useAutofixOverview({
    organization,
    selection,
    sort,
    enabled: pageFiltersReady,
  });
  useMilestoneAdvanceToasts(data, dataSettled);
  const projectConfigById = useMemo(
    () => new Map((projectConfig ?? []).map(config => [config.id, config])),
    [projectConfig]
  );
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
  const memberProjectIds = useMemo(
    () => Array.from(new Set(allRuns.map(run => run.issue.project.id))),
    [allRuns]
  );
  const {data: members = []} = useQuery({
    ...useProjectMembersQueryOptions(memberProjectIds),
    enabled: memberProjectIds.length > 0,
  });
  const membersByProject = useMemo(() => indexMembersByProject(members), [members]);
  // Sorted so a given id set yields a stable key regardless of run ordering.
  const assigneeTeamIds = useMemo(
    () =>
      Array.from(
        new Set(
          allRuns
            .map(run => run.issue.assignedTo)
            .filter((actor): actor is Actor => actor?.type === 'team')
            .map(actor => actor.id)
        )
      ).sort(),
    [allRuns]
  );
  const {teams: prefetchedTeams, isLoading: teamsLoading} = useTeamsById({
    ids: assigneeTeamIds,
  });
  const resolvedTeamIds = useMemo(
    () => new Set(prefetchedTeams.map(team => team.id)),
    [prefetchedTeams]
  );
  // Effect-deferred so it lands no earlier than the team-store prime: releasing
  // this gate during render would beat the prime by a frame and refire the N+1.
  const teamIdsKey = assigneeTeamIds.join(',');
  const [settledTeamIdsKey, setSettledTeamIdsKey] = useState<string | null>(null);
  useEffect(() => {
    if (!teamsLoading) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setSettledTeamIdsKey(teamIdsKey);
    }
  }, [teamsLoading, teamIdsKey]);
  const teamsSettled = teamIdsKey !== '' && settledTeamIdsKey === teamIdsKey;
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

  const orderedPrRunIds = populatedSections
    .filter(section => section.key === 'review_pr')
    .flatMap(section => section.runs)
    .filter(run => run.pullRequests.length > 0)
    .map(run => run.seerRunId);
  const scmWindows: string[][] = [];
  for (let start = 0; start < orderedPrRunIds.length; start += SCM_WINDOW_SIZE) {
    scmWindows.push(orderedPrRunIds.slice(start, start + SCM_WINDOW_SIZE));
  }
  const scmWindowsByRunId = new Map<string, string[][]>();
  scmWindows.forEach((window, index) => {
    const nextWindow = scmWindows[index + 1];
    const toRequest = nextWindow ? [window, nextWindow] : [window];
    for (const id of window) {
      scmWindowsByRunId.set(id, toRequest);
    }
  });

  const toggleGroup = (groupKey: StatusGroupKey, expanded: boolean) => {
    setCollapsedGroups(previous =>
      expanded
        ? previous.filter(key => key !== groupKey)
        : [...previous.filter(key => key !== groupKey), groupKey]
    );
  };

  const sectionRendererProps: OverviewSectionRendererProps = {
    sections: populatedSections,
    collapsedGroups,
    onToggle: toggleGroup,
    orgSlug: organization.slug,
    statsPeriod: selection.datetime.period,
    requestScmWindow,
    scmWindowsByRunId,
    isScmSettled,
    isVitalsPending,
    projectConfigById,
    membersByProject,
    resolvedTeamIds,
    teamsSettled,
  };

  const resultsPending = isPending || projectConfigPending || issueStatsPending;
  const populatedKeys = populatedSections.map(section => section.key);
  const allCollapsed =
    populatedKeys.length > 0 && populatedKeys.every(key => collapsedGroups.includes(key));
  const toggleAllLabel = allCollapsed ? t('Expand All') : t('Collapse All');

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
    <Stack gap="lg" padding={{xs: 'lg md', sm: 'lg xl'}}>
      <FilterBar gap="md" align="center" wrap="wrap">
        {pageFiltersReady && projectsLoaded ? (
          <PageFilterBar condensed>
            <ProjectPageFilter />
          </PageFilterBar>
        ) : (
          <ProjectFilterSkeleton />
        )}
        <DatePageFilter
          relativeOptions={activityRelativeOptions}
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
          truncated={(data?.truncatedMilestones?.length ?? 0) > 0}
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
        {canShowTable && (
          <Flex flex="1" justify="end">
            <SegmentedControl
              size="sm"
              aria-label={t('Display mode')}
              value={displayModeEffective}
              onChange={next => {
                setDisplayMode(next);
                trackFilterChanged('display', next);
              }}
            >
              <SegmentedControl.Item
                key="cards"
                aria-label={t('Card view')}
                icon={<IconGrid />}
              />
              <SegmentedControl.Item
                key="table"
                aria-label={t('Table view')}
                icon={<IconTable />}
              />
            </SegmentedControl>
          </Flex>
        )}
      </FilterBar>
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
              <Flex justify="between" align="center" gap="md">
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
                <Button
                  size="sm"
                  variant="link"
                  onClick={toggleAllGroups}
                  disabled={!resultsPending && populatedSections.length === 0}
                  aria-label={toggleAllLabel}
                  icon={<IconChevron isDouble direction={allCollapsed ? 'down' : 'up'} />}
                >
                  {breakpoints.xs ? toggleAllLabel : null}
                </Button>
              </Flex>
              {populatedSections.length === 0 ? (
                <EmptyState
                  padding="3xl"
                  title={t('No Autofix runs are currently in progress.')}
                />
              ) : displayModeEffective === 'table' ? (
                <OverviewSectionTable {...sectionRendererProps} />
              ) : (
                <OverviewSectionList {...sectionRendererProps} />
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
  requestScmWindow,
  scmWindowsByRunId,
  isScmSettled,
  isVitalsPending,
  projectConfigById,
  membersByProject,
  resolvedTeamIds,
  teamsSettled,
}: OverviewSectionRendererProps) {
  return (
    <Stack gap="lg">
      {sections.map(({key, runs}) => (
        <OverviewSectionDisclosure
          key={key}
          sectionKey={key}
          count={runs.length}
          expanded={!collapsedGroups.includes(key)}
          onToggle={next => onToggle(key, next)}
        >
          <Stack gap="md" paddingTop="sm">
            {runs.map(run => {
              const assignee = run.issue.assignedTo;
              const assigneeReady =
                assignee?.type !== 'team' ||
                resolvedTeamIds.has(assignee.id) ||
                teamsSettled;
              return (
                <OverviewCard
                  key={run.seerRunId}
                  run={run}
                  orgSlug={orgSlug}
                  sectionKey={key}
                  statsPeriod={statsPeriod}
                  scmSettled={isScmSettled(run.seerRunId)}
                  vitalsPending={isVitalsPending(run.seerRunId)}
                  requestScmWindow={requestScmWindow}
                  scmWindows={scmWindowsByRunId.get(run.seerRunId)}
                  projectConfig={projectConfigById.get(run.issue.project.id)}
                  memberList={membersByProject.get(run.issue.project.slug) ?? []}
                  assigneeReady={assigneeReady}
                />
              );
            })}
          </Stack>
        </OverviewSectionDisclosure>
      ))}
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
