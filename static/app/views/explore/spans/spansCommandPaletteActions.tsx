import {Fragment, memo, useCallback, useEffect, useRef, useState} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  CMDKChainedActionScope,
  CMDKTerminalActionScope,
} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useCommandPaletteState} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {
  updateDateTime,
  updateEnvironments,
  updateProjects,
} from 'sentry/components/pageFilters/actions';
import {
  ALL_ACCESS_PROJECTS,
  PROJECT_SELECTION_COUNT_LIMIT,
} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PlatformList} from 'sentry/components/platformList';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {
  IconAllProjects,
  IconClock,
  IconGlobe,
  IconMyProjects,
  IconProject,
  IconRefresh,
  IconSpan,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {DataCategory} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {defined} from 'sentry/utils/defined';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  EQUATION_PREFIX,
  parseFunction,
  prettifyParsedFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {trimSlug} from 'sentry/utils/string/trimSlug';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  addSearchFilterToQuery,
  getSearchFilterDescriptor,
  getFilterRows,
  removeSearchFilterFromQuery,
  replaceSearchFilterInQuery,
  type SearchFilter,
  TraceItemFilterActions,
  TraceItemFilterRows,
} from 'sentry/views/explore/components/traceItemFilterActions';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  DEFAULT_VISUALIZATION,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpansSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeFunction,
  isVisualizeEquation,
  MAX_VISUALIZES,
  type Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getMetricAlertsUpsellTooltip} from 'sentry/views/explore/utils/saveAsAlertMenuItem';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

const MORE_ACTIONS_ORDER = {
  addChart: 10,
  addEquation: 20,
  addGroupBy: 30,
  addFilter: 40,
  reorderCharts: 50,
  deleteChart: 60,
} as const;

const QUERY_ACTION_ORDER = {
  sort: 0,
  groupBy: 100,
  filter: 200,
} as const;

const ADD_FILTER_ACTION_ID = 'spans-add-filter';
const ADD_GROUP_BY_ACTION_ID = 'spans-add-group-by';

function getChangeFilterValueActionId(index: number): string {
  return `spans-change-filter-value-${index}`;
}

function getChangeGroupByActionId(index: number): string {
  return `spans-change-group-by-attribute-${index}`;
}

export function canCompareQueries(visualizes: Visualize[]): boolean {
  return visualizes.filter(isVisualizeFunction).length >= 2;
}

export function canReorderCharts(visualizes: readonly Visualize[]): boolean {
  if (visualizes.length <= 1) {
    return false;
  }
  return (
    new Set(visualizes.map(visualize => JSON.stringify(visualize.serialize()))).size > 1
  );
}

export function canDeleteChart(charts: readonly unknown[]): boolean {
  return charts.length >= 2;
}

export function deleteChart<T extends {id: number}>(
  charts: readonly T[],
  chartId: number
): T[] {
  return charts.filter(chart => chart.id !== chartId);
}

export function removeFilterRow(
  filters: {pendingRows: number; query: string},
  filterIndex: number
): {pendingRows: number; query: string} {
  const filterCount = getFilterRows(filters.query).length;
  const query =
    filterIndex < filterCount
      ? removeSearchFilterFromQuery(filters.query, filterIndex)
      : filters.query;
  let pendingRows =
    filterIndex < filterCount
      ? filters.pendingRows
      : Math.max(0, filters.pendingRows - 1);

  if (getFilterRows(query).length + pendingRows === 0) {
    pendingRows = 1;
  }

  return {pendingRows, query};
}

export function clearFilterRow(
  filters: {pendingRows: number; query: string},
  filterIndex: number
): {pendingRows: number; query: string} {
  if (filterIndex >= getFilterRows(filters.query).length) {
    return filters;
  }

  return {
    pendingRows: filters.pendingRows + 1,
    query: removeSearchFilterFromQuery(filters.query, filterIndex),
  };
}

export function reorderCharts<T>(
  charts: readonly T[],
  index: number,
  direction: 'up' | 'down'
): T[] {
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (
    index < 0 ||
    index >= charts.length ||
    nextIndex < 0 ||
    nextIndex >= charts.length
  ) {
    return [...charts];
  }

  const reorderedCharts = [...charts];
  const chart = reorderedCharts[index];
  const nextChart = reorderedCharts[nextIndex];
  if (chart === undefined || nextChart === undefined) {
    return reorderedCharts;
  }
  [reorderedCharts[index], reorderedCharts[nextIndex]] = [nextChart, chart];
  return reorderedCharts;
}

function SaveAsActionsComponent() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();
  const [interval] = useChartInterval();
  const {addToDashboard} = useAddToDashboard();
  const {saveQuery} = useSpansSaveQuery();
  const query = useQueryParamsQuery();
  const visualizes = useQueryParamsVisualizes().filter(isVisualizeFunction);
  const visualizeYAxes = dedupeArray(visualizes.map(visualize => visualize.yAxis));
  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(
          candidate => candidate.id === `${pageFilters.selection.projects[0]}`
        );
  const canCreateMonitors = !getMetricAlertsUpsellTooltip(organization);
  const canAddToDashboard = organization.features.includes('dashboards-edit');

  return (
    <CMDKAction display={{label: t('Save as')}}>
      <CMDKTerminalActionScope>
        <CMDKAction
          display={{label: t('New Query')}}
          onAction={() => {
            trackAnalytics('trace_explorer.save_query_modal', {
              action: 'open',
              save_type: 'save_new_query',
              ui_source: 'toolbar',
              organization,
            });
            openSaveQueryModal({
              organization,
              saveQuery,
              source: 'toolbar',
              traceItemDataset: TraceItemDataset.SPANS,
            });
          }}
        />
      </CMDKTerminalActionScope>
      {canCreateMonitors && visualizeYAxes.length > 0 && (
        <CMDKAction
          display={{label: t('Monitor for')}}
          prompt={t('Select a series to monitor')}
        >
          {visualizeYAxes.map((yAxis, index) => {
            const parsedFunction = parseFunction(yAxis);
            const label = parsedFunction ? prettifyParsedFunction(parsedFunction) : yAxis;

            return (
              <CMDKAction
                key={`${yAxis}-${index}`}
                display={{label}}
                to={getAlertsUrl({
                  project,
                  query,
                  pageFilters: pageFilters.selection,
                  aggregate: yAxis,
                  organization,
                  dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                  interval,
                })}
                onAction={() => {
                  trackAnalytics('trace_explorer.save_as', {
                    save_type: 'alert',
                    ui_source: 'toolbar',
                    organization,
                  });
                }}
              />
            );
          })}
        </CMDKAction>
      )}
      {canAddToDashboard && visualizeYAxes.length > 0 && (
        <CMDKTerminalActionScope>
          {visualizeYAxes.length === 1 ? (
            <CMDKAction
              display={{label: t('Dashboard widget')}}
              onAction={() => {
                trackAnalytics('trace_explorer.save_as', {
                  save_type: 'dashboard',
                  ui_source: 'toolbar',
                  organization,
                });
                addToDashboard(0);
              }}
            />
          ) : (
            <CMDKAction
              display={{label: t('Dashboard widget')}}
              prompt={t('Select a series for the dashboard widget')}
            >
              {visualizeYAxes.map((yAxis, index) => {
                const parsedFunction = parseFunction(yAxis);
                return (
                  <CMDKAction
                    key={`${yAxis}-${index}`}
                    display={{
                      label: parsedFunction
                        ? prettifyParsedFunction(parsedFunction)
                        : yAxis,
                    }}
                    onAction={() => {
                      trackAnalytics('trace_explorer.save_as', {
                        save_type: 'dashboard',
                        ui_source: 'toolbar',
                        organization,
                      });
                      addToDashboard(index);
                    }}
                  />
                );
              })}
            </CMDKAction>
          )}
        </CMDKTerminalActionScope>
      )}
    </CMDKAction>
  );
}

const SaveAsActions = memo(SaveAsActionsComponent);

const RELATIVE_TIME_RANGES = [
  {days: 1 / 24, label: t('Last hour'), period: '1h'},
  {days: 1, label: t('Last 24 hours'), period: '24h'},
  {days: 7, label: t('Last 7 days'), period: '7d'},
  {days: 14, label: t('Last 14 days'), period: '14d'},
  {days: 30, label: t('Last 30 days'), period: '30d'},
  {days: 90, label: t('Last 90 days'), period: '90d'},
] as const;

export function getProjectsForSelection(
  projects: Project[],
  selectedProjects: number[],
  isSuperuser = false
): Project[] {
  if (selectedProjects.includes(ALL_ACCESS_PROJECTS)) {
    return projects.filter(project => project.hasAccess);
  }
  if (selectedProjects.length === 0) {
    return projects.filter(project => project.isMember || isSuperuser);
  }
  return projects.filter(project => selectedProjects.includes(Number(project.id)));
}

export function getToggledProjectSelection(
  selectedProjectIds: number[],
  projectId: number
): number[] | undefined {
  if (selectedProjectIds.includes(projectId)) {
    return selectedProjectIds.filter(id => id !== projectId);
  }
  return selectedProjectIds.length < PROJECT_SELECTION_COUNT_LIMIT
    ? [...selectedProjectIds, projectId]
    : undefined;
}

export function isProjectSelectionLimitExceeded(selectedProjectIds: number[]): boolean {
  return (
    !selectedProjectIds.includes(ALL_ACCESS_PROJECTS) &&
    selectedProjectIds.length > PROJECT_SELECTION_COUNT_LIMIT
  );
}

export function addGroupByToDraftState(
  current: {groupBys: string[]; pendingRows: number},
  groupBy: string
): {groupBys: string[]; pendingRows: number} {
  if (current.groupBys.includes(groupBy)) {
    return current;
  }
  return {
    groupBys: [...current.groupBys, groupBy],
    pendingRows: 0,
  };
}

export function getProjectScopeLabel(
  projects: ReturnType<typeof useProjects>['projects'],
  ids: number[]
) {
  if (ids.includes(ALL_ACCESS_PROJECTS)) {
    return t('All Projects');
  }
  if (ids.length === 0) {
    return t('My Projects');
  }
  const memberProjectIds = projects
    .filter(project => project.isMember)
    .map(project => Number(project.id));
  const selectedProjectIds = new Set(ids);
  const includesAllMemberProjects =
    memberProjectIds.length > 0 &&
    memberProjectIds.every(id => selectedProjectIds.has(id));
  if (includesAllMemberProjects) {
    const additionalProjectCount = ids.filter(
      id => !memberProjectIds.includes(id)
    ).length;

    return additionalProjectCount > 0
      ? t('My Projects +%s', additionalProjectCount)
      : t('My Projects');
  }
  const selectedProjects = ids
    .map(id => projects.find(project => Number(project.id) === id))
    .filter((project): project is Project => project !== undefined);
  const projectsToShow =
    (selectedProjects[0]?.slug.length ?? 0) + (selectedProjects[1]?.slug.length ?? 0) <=
    23
      ? selectedProjects.slice(0, 2)
      : selectedProjects.slice(0, 1);
  const label = projectsToShow.map(project => trimSlug(project.slug, 25)).join(', ');
  const remainingCount = ids.length - projectsToShow.length;

  return remainingCount > 0 ? `${label}, +${remainingCount}` : label;
}

export function getEnvironmentScopeLabel(environments: string[]) {
  if (environments.length === 0) {
    return t('All Environments');
  }
  const environmentsToShow =
    (environments[0]?.length ?? 0) + (environments[1]?.length ?? 0) <= 23
      ? environments.slice(0, 2)
      : environments.slice(0, 1);
  const label = environmentsToShow
    .map(environment => trimSlug(environment, 25))
    .join(', ');
  const remainingCount = environments.length - environmentsToShow.length;

  return remainingCount > 0 ? `${label}, +${remainingCount}` : label;
}

function SpansScopeActions({
  draftPageFilters,
  setDraftPageFilters,
}: {
  draftPageFilters: PageFilters;
  setDraftPageFilters: React.Dispatch<React.SetStateAction<PageFilters>>;
}) {
  const {projects} = useProjects();
  const commandPaletteState = useCommandPaletteState();
  const [currentPageFilters, setCurrentPageFilters] = useState(draftPageFilters);
  const lastMultiSelectedProjectRef = useRef<number | null>(null);
  const lastMultiSelectedEnvironmentRef = useRef<string | null>(null);
  const isSuperuser = isActiveSuperuser();
  const {maxPickableDays} = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const selectedProjects = draftPageFilters.projects;
  const selectedEnvironments = draftPageFilters.environments;
  let navigationAction = commandPaletteState.action;
  let isScopePickerOpen = false;
  while (navigationAction) {
    if (
      [t('Projects'), t('Environments'), t('Time range')].includes(
        navigationAction.value.label
      )
    ) {
      isScopePickerOpen = true;
      break;
    }
    navigationAction = navigationAction.previous;
  }
  useEffect(() => {
    if (!isScopePickerOpen) {
      // This is an intentional step-0 snapshot, not derived render state. Picker edits
      // should not become "Current" until the user returns to the scope summary.
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setCurrentPageFilters(draftPageFilters);
    }
  }, [draftPageFilters, isScopePickerOpen]);
  const projectsInDraftScope = getProjectsForSelection(
    projects,
    selectedProjects,
    isSuperuser
  );
  const selectedProjectModels = projectsInDraftScope;
  const effectiveSelectedProjectIds = projectsInDraftScope.map(project =>
    Number(project.id)
  );
  const currentEffectiveProjectIds = getProjectsForSelection(
    projects,
    currentPageFilters.projects,
    isSuperuser
  ).map(project => Number(project.id));
  const availableEnvironments = [
    ...new Set(projectsInDraftScope.flatMap(project => project.environments)),
  ].toSorted();
  const shouldShowProjectReset = selectedProjects.length > 0;
  const shouldShowEnvironmentReset = selectedEnvironments.length > 0;
  const hasExplicitCurrentProjectSelection =
    currentPageFilters.projects.length > 0 &&
    !currentPageFilters.projects.includes(ALL_ACCESS_PROJECTS);
  const timeRangeLabel =
    RELATIVE_TIME_RANGES.find(
      option => option.period === draftPageFilters.datetime.period
    )?.label ?? t('Custom');

  const getPageFiltersWithProjects = (
    current: PageFilters,
    nextProjects: number[]
  ): PageFilters => {
    const nextAvailableProjects = getProjectsForSelection(
      projects,
      nextProjects,
      isSuperuser
    );
    const nextEnvironmentSet = new Set(
      nextAvailableProjects.flatMap(project => project.environments)
    );
    return {
      ...current,
      projects: nextProjects,
      environments: current.environments.filter(environment =>
        nextEnvironmentSet.has(environment)
      ),
    };
  };

  const setProjects = (nextProjects: number[]) => {
    setDraftPageFilters(current => getPageFiltersWithProjects(current, nextProjects));
  };

  const toggleProject = (projectId: number) => {
    setDraftPageFilters(current => {
      const currentProjectIds = getProjectsForSelection(
        projects,
        current.projects,
        isSuperuser
      ).map(project => Number(project.id));
      const nextProjects = getToggledProjectSelection(currentProjectIds, projectId);

      return nextProjects ? getPageFiltersWithProjects(current, nextProjects) : current;
    });
  };

  const commitProject = (projectId: number) => {
    if (lastMultiSelectedProjectRef.current === projectId) {
      lastMultiSelectedProjectRef.current = null;
      return;
    }
    toggleProject(projectId);
  };

  return (
    <CMDKAction
      display={{label: t('Global')}}
      keywords={['global', 'scope', 'selectors', 'project', 'environment', 'time']}
    >
      <CMDKAction
        display={{
          label: t('Projects'),
          trailingItem: (
            <QueryValue
              value={getProjectScopeLabel(projects, draftPageFilters.projects)}
            />
          ),
          icon:
            selectedProjects.length === 0 ? (
              <IconMyProjects data-test-id="icon-my-projects" />
            ) : selectedProjects.includes(ALL_ACCESS_PROJECTS) ? (
              <IconAllProjects data-test-id="icon-all-projects" />
            ) : selectedProjectModels.length === 1 ? (
              <PlatformList
                platforms={selectedProjectModels.map(
                  project => project.platform ?? 'other'
                )}
                size={16}
              />
            ) : (
              <IconProject data-test-id="icon-projects" />
            ),
        }}
        keywords={['scope', 'project', 'projects']}
        prompt={t('Search for projects')}
      >
        <CMDKChainedActionScope>
          <CMDKAction
            actionPanel={{
              context: 'project-selection',
              label: t('Reset Project Selection'),
              only: true,
            }}
            display={{label: t('Reset Project Selection'), icon: <IconRefresh />}}
            onAction={() =>
              setDraftPageFilters(current => ({
                ...current,
                projects: [],
                environments: [],
              }))
            }
          />
        </CMDKChainedActionScope>
        <CMDKAction
          actionContext={shouldShowProjectReset ? 'project-selection' : undefined}
          display={{
            label: t('My Projects'),
            icon: <IconMyProjects />,
            labelSuffix:
              currentPageFilters.projects.length === 0 ? (
                <QueryValue value={t('Current')} />
              ) : undefined,
          }}
          isSelected={selectedProjects.length === 0}
          onAction={() => setProjects([])}
        />
        <CMDKAction
          actionContext={shouldShowProjectReset ? 'project-selection' : undefined}
          display={{
            label: t('All Projects'),
            icon: <IconAllProjects />,
            labelSuffix: currentPageFilters.projects.includes(ALL_ACCESS_PROJECTS) ? (
              <QueryValue value={t('Current')} />
            ) : undefined,
          }}
          isSelected={selectedProjects.includes(ALL_ACCESS_PROJECTS)}
          onAction={() => setProjects([ALL_ACCESS_PROJECTS])}
        />
        {projects.map(project => {
          const projectId = Number(project.id);
          const isSelected = effectiveSelectedProjectIds.includes(projectId);
          const toggledProjects = getToggledProjectSelection(
            effectiveSelectedProjectIds,
            projectId
          );
          return (
            <CMDKAction
              key={project.id}
              actionContext={shouldShowProjectReset ? 'project-selection' : undefined}
              disabled={toggledProjects === undefined}
              display={{
                label: project.slug,
                icon: <ProjectAvatar project={project} size={16} />,
                labelSuffix:
                  hasExplicitCurrentProjectSelection &&
                  currentEffectiveProjectIds.includes(projectId) ? (
                    <QueryValue value={t('Current')} />
                  ) : undefined,
              }}
              isSelected={isSelected}
              onAction={() => commitProject(projectId)}
              onMultiSelect={
                toggledProjects
                  ? () => {
                      lastMultiSelectedProjectRef.current = projectId;
                      toggleProject(projectId);
                    }
                  : undefined
              }
            />
          );
        })}
      </CMDKAction>

      <CMDKAction
        display={{
          label: t('Environments'),
          trailingItem: (
            <QueryValue value={getEnvironmentScopeLabel(draftPageFilters.environments)} />
          ),
          icon: <IconGlobe />,
        }}
        keywords={['scope', 'environment', 'environments']}
        prompt={t('Search for environments')}
      >
        <CMDKChainedActionScope>
          <CMDKAction
            actionPanel={{
              context: 'environment-selection',
              label: t('Reset Environment Selection'),
              only: true,
            }}
            display={{label: t('Reset Environment Selection'), icon: <IconRefresh />}}
            onAction={() =>
              setDraftPageFilters(current => ({
                ...current,
                environments: [],
              }))
            }
          />
        </CMDKChainedActionScope>
        <CMDKAction
          actionContext={shouldShowEnvironmentReset ? 'environment-selection' : undefined}
          display={{
            label: t('All Environments'),
            icon: <IconGlobe />,
            labelSuffix:
              currentPageFilters.environments.length === 0 ? (
                <QueryValue value={t('Current')} />
              ) : undefined,
          }}
          isSelected={selectedEnvironments.length === 0}
          onAction={() =>
            setDraftPageFilters(current => ({...current, environments: []}))
          }
        />
        {availableEnvironments.map(environment => {
          const isSelected = selectedEnvironments.includes(environment);
          const toggleEnvironment = () =>
            setDraftPageFilters(current => ({
              ...current,
              environments: current.environments.includes(environment)
                ? current.environments.filter(value => value !== environment)
                : [...current.environments, environment],
            }));
          const commitEnvironment = () => {
            if (lastMultiSelectedEnvironmentRef.current === environment) {
              lastMultiSelectedEnvironmentRef.current = null;
              return;
            }
            toggleEnvironment();
          };

          return (
            <CMDKAction
              key={environment}
              actionContext={
                shouldShowEnvironmentReset ? 'environment-selection' : undefined
              }
              display={{
                label: environment,
                icon: <IconGlobe />,
                labelSuffix: currentPageFilters.environments.includes(environment) ? (
                  <QueryValue value={t('Current')} />
                ) : undefined,
              }}
              isSelected={isSelected}
              onAction={commitEnvironment}
              onMultiSelect={() => {
                lastMultiSelectedEnvironmentRef.current = environment;
                toggleEnvironment();
              }}
            />
          );
        })}
      </CMDKAction>

      <CMDKAction
        display={{
          label: t('Time range'),
          trailingItem: <QueryValue value={timeRangeLabel} />,
          icon: <IconClock />,
        }}
        keywords={['scope', 'time', 'date', 'range', 'period']}
        prompt={t('Select a time range')}
      >
        {RELATIVE_TIME_RANGES.filter(option => option.days <= maxPickableDays).map(
          option => {
            const isSelected = draftPageFilters.datetime.period === option.period;

            return (
              <CMDKAction
                key={option.period}
                display={{
                  label: option.label,
                  labelSuffix:
                    currentPageFilters.datetime.period === option.period ? (
                      <QueryValue value={t('Current')} />
                    ) : undefined,
                  icon: <IconClock />,
                }}
                isSelected={isSelected}
                onAction={() =>
                  setDraftPageFilters(current => ({
                    ...current,
                    datetime: {
                      end: null,
                      period: option.period,
                      start: null,
                      utc: null,
                    },
                  }))
                }
              />
            );
          }
        )}
      </CMDKAction>
    </CMDKAction>
  );
}

function SpansFilterActionsComponent({
  addSearchFilter,
  actionPanel,
  filters,
  replaceSearchFilter,
}: {
  actionPanel: {
    context: string;
    label: string;
    only: boolean;
    order: number;
  };
  addSearchFilter: (filter: SearchFilter) => void;
  filters: readonly string[];
  replaceSearchFilter: (filterIndex: number, filter: SearchFilter) => void;
}) {
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  return (
    <Fragment>
      <TraceItemFilterActions
        actionPanel={actionPanel}
        addSearchFilter={addSearchFilter}
        booleanAttributes={booleanAttributes}
        id={ADD_FILTER_ACTION_ID}
        stringAttributes={stringAttributes}
        traceItemType={TraceItemDataset.SPANS}
      />
      {filters.map((filter, filterIndex) => {
        const actionContext = `filter:${filterIndex}`;
        const descriptor = getSearchFilterDescriptor(filter);
        const attributeKey = descriptor?.attributeKey ?? null;
        const hasAttribute =
          attributeKey !== null &&
          (stringAttributes[attributeKey] !== undefined ||
            booleanAttributes[attributeKey] !== undefined);
        const onChange = (nextFilter: SearchFilter) =>
          replaceSearchFilter(filterIndex, nextFilter);

        return (
          <Fragment key={`filter-actions-${filterIndex}`}>
            <TraceItemFilterActions
              actionPanel={{
                context: actionContext,
                label: t('Change Filter Attribute'),
                only: true,
              }}
              addSearchFilter={onChange}
              booleanAttributes={booleanAttributes}
              displayLabel={t('Change Filter Attribute')}
              id={`spans-change-filter-attribute-${filterIndex}`}
              stringAttributes={stringAttributes}
              traceItemType={TraceItemDataset.SPANS}
            />
            {hasAttribute && (
              <TraceItemFilterActions
                actionPanel={{
                  context: actionContext,
                  label: t('Change Filter Operator'),
                  only: true,
                }}
                addSearchFilter={onChange}
                booleanAttributes={booleanAttributes}
                displayLabel={t('Change Filter Operator')}
                id={`spans-change-filter-operator-${filterIndex}`}
                initialAttributeKey={attributeKey}
                stringAttributes={stringAttributes}
                traceItemType={TraceItemDataset.SPANS}
              />
            )}
            {descriptor && (
              <TraceItemFilterActions
                actionPanel={{
                  context: actionContext,
                  label: t('Change Filter Value'),
                  only: true,
                }}
                addSearchFilter={onChange}
                booleanAttributes={booleanAttributes}
                displayLabel={t('Change Filter Value')}
                id={getChangeFilterValueActionId(filterIndex)}
                initialAttributeKey={descriptor.attributeKey}
                initialOperator={descriptor.operator}
                stringAttributes={stringAttributes}
                traceItemType={TraceItemDataset.SPANS}
              />
            )}
          </Fragment>
        );
      })}
    </Fragment>
  );
}

const SpansFilterActions = memo(SpansFilterActionsComponent);

interface SeriesActionsProps {
  chartId: number;
  index: number;
  seriesId: string;
  updateVisualize: (chartId: number, visualize: Visualize) => void;
  visualize: Visualize;
  visualizes: readonly Visualize[];
}

function SeriesActionsComponent({
  chartId,
  index,
  seriesId,
  updateVisualize,
  visualize,
  visualizes,
}: SeriesActionsProps) {
  if (isVisualizeEquation(visualize)) {
    const expression = stripEquationPrefix(visualize.yAxis);

    return (
      <CMDKAction
        id={`${seriesId}-equation`}
        display={{
          label: t('Edit Equation'),
          trailingItem: <QueryValue value={expression} />,
        }}
        textInput={{
          ariaLabel: t('Edit Equation'),
          initialValue: expression,
          onSubmit: value =>
            updateVisualize(
              chartId,
              visualize.replace({yAxis: `${EQUATION_PREFIX}${value}`})
            ),
          footer: <EquationFooter index={index} visualizes={visualizes} />,
        }}
      />
    );
  }

  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const sourceSummary = parsedFunction?.arguments[0] ?? visualize.yAxis;
  const aggregateSummary = parsedFunction?.name ?? t('Equation');

  return (
    <Fragment>
      <CMDKAction
        id={`${seriesId}-source`}
        deferChildren
        display={{
          label: t('Source'),
          trailingItem: <QueryValue value={sourceSummary} />,
        }}
        prompt={t('Search for sources')}
      >
        <SourceActions
          visualize={visualize}
          onChange={nextVisualize => updateVisualize(chartId, nextVisualize)}
        />
      </CMDKAction>
      <CMDKAction
        id={`${seriesId}-aggregate`}
        display={{
          label: t('Aggregate function'),
          trailingItem: <QueryValue value={aggregateSummary} />,
        }}
        prompt={t('Search for aggregate functions')}
      >
        {isVisualizeFunction(visualize) &&
          ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => (
            <CMDKAction
              key={aggregate}
              display={{
                label: aggregate,
                labelSuffix:
                  aggregate === aggregateSummary ? (
                    <QueryValue value={t('Current')} />
                  ) : undefined,
                trailingItem: getAggregateKind(aggregate),
              }}
              onAction={() => {
                const currentFunction = visualize.parsedFunction;
                if (!currentFunction) {
                  return;
                }
                updateVisualize(
                  chartId,
                  visualize.replace({
                    yAxis: updateVisualizeAggregate({
                      newAggregate: aggregate,
                      oldAggregate: currentFunction.name,
                      oldArguments: currentFunction.arguments,
                    }),
                  })
                );
              }}
            />
          ))}
      </CMDKAction>
    </Fragment>
  );
}

function areSeriesActionsPropsEqual(
  previous: SeriesActionsProps,
  next: SeriesActionsProps
): boolean {
  if (
    previous.chartId !== next.chartId ||
    previous.index !== next.index ||
    previous.seriesId !== next.seriesId ||
    previous.updateVisualize !== next.updateVisualize ||
    previous.visualize !== next.visualize
  ) {
    return false;
  }

  if (!isVisualizeEquation(next.visualize)) {
    return true;
  }

  // The equation footer renders every other chart, so additions, removals, and
  // reordering must refresh the existing equation action tree.
  return (
    previous.visualizes.length === next.visualizes.length &&
    previous.visualizes.every((visualize, index) => visualize === next.visualizes[index])
  );
}

const SeriesActions = memo(SeriesActionsComponent, areSeriesActionsPropsEqual);

export function EquationFooter({
  index,
  visualizes,
}: {
  index: number;
  visualizes: readonly Visualize[];
}) {
  const referencedSeries = visualizes.flatMap((series, seriesIndex) =>
    seriesIndex === index ? [] : [{series, seriesIndex}]
  );

  return (
    <Flex align="center" justify="end" gap="lg" flex={1} minWidth={0}>
      <Flex align="center" gap="md" minWidth={0} overflow="hidden">
        {referencedSeries.map(({series, seriesIndex}) => (
          <Flex key={seriesIndex} align="center" gap="xs" minWidth={0}>
            <Text size="sm" variant="accent">
              {String.fromCharCode(65 + seriesIndex)}
            </Text>
            <Text size="sm" ellipsis>
              {isVisualizeEquation(series)
                ? stripEquationPrefix(series.yAxis)
                : series.yAxis}
            </Text>
          </Flex>
        ))}
      </Flex>
      <Flex align="center" gap="xs" flexShrink={0}>
        <Text size="sm" variant="accent">
          + − / *
        </Text>
        <Text size="sm">{t('operators')}</Text>
      </Flex>
    </Flex>
  );
}

function GroupByActionsComponent({
  currentGroupBy,
  groupBys,
  onSelect,
}: {
  groupBys: readonly string[];
  onSelect: (groupBy: string) => void;
  currentGroupBy?: string;
}) {
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  const options = useGroupByFields({
    booleanTags,
    groupBys,
    numberTags,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  }).filter(option => option.value !== UNGROUPED);

  return (
    <CMDKAction display={{label: t('Attribute')}}>
      {options.map(option => {
        const isCurrent = currentGroupBy
          ? option.value === currentGroupBy
          : groupBys.includes(option.value);
        const isUnavailable = groupBys.includes(option.value) && !isCurrent;

        return (
          <CMDKAction
            key={option.value}
            disabled={isUnavailable}
            display={{
              label: option.textValue ?? option.value,
              labelSuffix: isCurrent ? <QueryValue value={t('Current')} /> : undefined,
              trailingItem:
                typeof option.trailingItems === 'function'
                  ? option.trailingItems({
                      disabled: isUnavailable,
                      isFocused: false,
                      isSelected: isCurrent,
                    })
                  : option.trailingItems,
            }}
            keywords={[option.value]}
            onAction={() => {
              if (!isUnavailable) {
                onSelect(option.value);
              }
            }}
          />
        );
      })}
    </CMDKAction>
  );
}

const GroupByActions = memo(GroupByActionsComponent);

function SortActions({
  groupBys,
  mode,
  setSortBys,
  sortBys,
  visualizes,
}: {
  groupBys: readonly string[];
  mode: Mode;
  setSortBys: (sortBys: Sort[]) => void;
  sortBys: readonly Sort[];
  visualizes: readonly Visualize[];
}) {
  const fields = useQueryParamsFields();
  const currentSort = sortBys[0];
  const fieldOptions = useSortByFields({
    config: {traceItemType: TraceItemDataset.SPANS, enabled: true},
    fields,
    groupBys,
    mode,
    yAxes: visualizes.map(visualize => visualize.yAxis),
  });
  const currentSortKind = currentSort?.kind ?? 'desc';

  return (
    <CMDKAction display={{label: t('Sort by')}}>
      {fieldOptions.map(option => (
        <CMDKAction
          key={option.value}
          display={{
            label: option.textValue ?? option.value,
            labelSuffix:
              option.value === currentSort?.field ? (
                <QueryValue value={t('Current')} />
              ) : undefined,
            trailingItem:
              typeof option.trailingItems === 'function'
                ? option.trailingItems({
                    disabled: false,
                    isFocused: false,
                    isSelected: option.value === currentSort?.field,
                  })
                : option.trailingItems,
          }}
          keywords={[option.value]}
          prompt={t('Select sort order')}
        >
          <CMDKAction display={{label: t('Order by')}}>
            {(['desc', 'asc'] as const).map(kind => (
              <CMDKAction
                key={kind}
                display={{
                  label: kind === 'desc' ? t('Desc') : t('Asc'),
                  labelSuffix:
                    currentSortKind === kind ? (
                      <QueryValue value={t('Current')} />
                    ) : undefined,
                }}
                onAction={() => setSortBys([{field: option.value, kind}])}
              />
            ))}
          </CMDKAction>
        </CMDKAction>
      ))}
    </CMDKAction>
  );
}

function SourceActions({
  onChange,
  visualize,
}: {
  onChange: (visualize: Visualize) => void;
  visualize: Visualize;
}) {
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  const parsedFunction = isVisualizeFunction(visualize) ? visualize.parsedFunction : null;
  const options = useVisualizeFields({
    booleanTags,
    numberTags,
    parsedFunction,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  if (!isVisualizeFunction(visualize) || !parsedFunction) {
    return null;
  }

  return options.map(option => (
    <CMDKAction
      key={option.value}
      display={{
        label: option.textValue ?? option.value,
        labelSuffix:
          option.value === parsedFunction.arguments[0] ? (
            <QueryValue value={t('Current')} />
          ) : undefined,
        trailingItem:
          typeof option.trailingItems === 'function'
            ? option.trailingItems({
                disabled: false,
                isFocused: false,
                isSelected: option.value === parsedFunction.arguments[0],
              })
            : option.trailingItems,
      }}
      keywords={[option.value]}
      onAction={() =>
        onChange(
          visualize.replace({
            yAxis: `${parsedFunction.name}(${option.value})`,
          })
        )
      }
    />
  ));
}

function getAggregateKind(aggregate: string): React.ReactNode {
  if (aggregate.startsWith('p') || aggregate === 'percentile') {
    return (
      <Text size="sm" variant="accent">
        {t('Percentile')}
      </Text>
    );
  }
  if (aggregate === 'avg' || aggregate === 'count_unique') {
    return (
      <Text size="sm" variant="promotion">
        {t('Algebraic')}
      </Text>
    );
  }
  return (
    <Text size="sm" variant="success">
      {t('Distributive')}
    </Text>
  );
}

function QueryValue({value}: {value: string}) {
  return (
    <Text size="sm" variant={value ? 'accent' : 'muted'} ellipsis>
      {value || t('None')}
    </Text>
  );
}

function QueryClauseActions() {
  const commandPaletteState = useCommandPaletteState();
  const {selection: pageFilterSelection} = usePageFilters();
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const draftKey = commandPaletteState.open
    ? 'open'
    : JSON.stringify({
        aggregateSortBys,
        groupBys,
        pageFilterSelection,
        query,
        sampleSortBys,
        visualizes: visualizes.map(visualize => visualize.serialize()),
      });

  return <QueryClauseActionsEditor key={draftKey} />;
}

function QueryClauseActionsEditor() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection: pageFilterSelection} = usePageFilters();
  const setQueryParams = useSetQueryParams();
  const visualizes = useQueryParamsVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const sampleSortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const crossEvents = useQueryParamsCrossEvents();
  const [caseInsensitive] = useCaseInsensitivity();
  const [draftFilters, setDraftFilters] = useState(() => ({
    pendingRows: getFilterRows(query).length === 0 ? 1 : 0,
    query,
  }));
  const [draftPageFilters, setDraftPageFilters] = useState<PageFilters>(() => ({
    ...pageFilterSelection,
    datetime: {...pageFilterSelection.datetime},
    environments: [...pageFilterSelection.environments],
    projects: [...pageFilterSelection.projects],
  }));
  const [draftCharts, setDraftCharts] = useState(() =>
    visualizes.map((visualize, id) => ({id, visualize}))
  );
  const [draftGroupByState, setDraftGroupByState] = useState(() => {
    const definedGroupBys = groupBys.filter(Boolean);
    return {
      groupBys: definedGroupBys,
      pendingRows: Math.max(
        groupBys.length - definedGroupBys.length,
        definedGroupBys.length === 0 ? 1 : 0
      ),
    };
  });
  const [draftSampleSortBys, setDraftSampleSortBys] = useState<Sort[]>([
    ...sampleSortBys,
  ]);
  const [draftAggregateSortBys, setDraftAggregateSortBys] = useState<Sort[]>([
    ...aggregateSortBys,
  ]);

  const addSearchFilter = useCallback((filter: SearchFilter) => {
    setDraftFilters(current => {
      const nextQuery = addSearchFilterToQuery(current.query, filter);
      if (nextQuery === current.query) {
        return current;
      }
      return {
        pendingRows: Math.max(0, current.pendingRows - 1),
        query: nextQuery,
      };
    });
  }, []);
  const addGroupBy = useCallback((groupBy: string) => {
    setDraftGroupByState(current => addGroupByToDraftState(current, groupBy));
  }, []);
  const addPendingGroupByRow = useCallback(() => {
    setDraftGroupByState(current => ({
      ...current,
      pendingRows: current.pendingRows + 1,
    }));
  }, []);
  const addPendingFilterRow = useCallback(() => {
    setDraftFilters(current => ({
      ...current,
      pendingRows: current.pendingRows + 1,
    }));
  }, []);
  const replaceGroupBy = (index: number, groupBy: string) => {
    setDraftGroupByState(current => {
      if (
        index < 0 ||
        index >= current.groupBys.length ||
        current.groupBys.some((value, valueIndex) =>
          valueIndex === index ? false : value === groupBy
        )
      ) {
        return current;
      }

      return {
        ...current,
        groupBys: current.groupBys.map((value, valueIndex) =>
          valueIndex === index ? groupBy : value
        ),
      };
    });
  };
  const clearGroupBy = (index: number) => {
    setDraftGroupByState(current => {
      if (index < 0 || index >= current.groupBys.length) {
        return current;
      }
      return {
        groupBys: current.groupBys.filter((_, valueIndex) => valueIndex !== index),
        pendingRows: current.pendingRows + 1,
      };
    });
  };
  const removeGroupBy = (index: number) => {
    setDraftGroupByState(current => {
      const removesGroupBy = index >= 0 && index < current.groupBys.length;
      const groupBysAfterRemoval = removesGroupBy
        ? current.groupBys.filter((_, valueIndex) => valueIndex !== index)
        : current.groupBys;
      let pendingRowsAfterRemoval = removesGroupBy
        ? current.pendingRows
        : Math.max(0, current.pendingRows - 1);

      if (groupBysAfterRemoval.length + pendingRowsAfterRemoval === 0) {
        pendingRowsAfterRemoval = 1;
      }

      return {
        groupBys: groupBysAfterRemoval,
        pendingRows: pendingRowsAfterRemoval,
      };
    });
  };
  const removeSearchFilter = useCallback((filterIndex: number) => {
    setDraftFilters(current => removeFilterRow(current, filterIndex));
  }, []);
  const clearSearchFilter = useCallback((filterIndex: number) => {
    setDraftFilters(current => clearFilterRow(current, filterIndex));
  }, []);
  const replaceSearchFilter = useCallback((filterIndex: number, filter: SearchFilter) => {
    setDraftFilters(current => ({
      ...current,
      query: replaceSearchFilterInQuery(current.query, filterIndex, filter),
    }));
  }, []);

  const draftGroupBys = draftGroupByState.groupBys;
  const pendingGroupByRows = draftGroupByState.pendingRows;
  const draftQuery = draftFilters.query;
  const draftMode = draftGroupBys.some(Boolean) ? Mode.AGGREGATE : Mode.SAMPLES;
  const draftVisualizes = draftCharts.map(chart => chart.visualize);
  const draftSortBys =
    draftMode === Mode.SAMPLES ? draftSampleSortBys : draftAggregateSortBys;
  const draftVisualizeFunctions = draftVisualizes.filter(isVisualizeFunction);
  const hasCrossEvents = defined(crossEvents) && crossEvents.length > 0;
  const projectSelectionLimitExceeded = isProjectSelectionLimitExceeded(
    draftPageFilters.projects
  );
  const setDraftSortBys =
    draftMode === Mode.SAMPLES ? setDraftSampleSortBys : setDraftAggregateSortBys;
  const sortBySummary = draftSortBys
    .map(sort => `${sort.field}, ${sort.kind}`)
    .join(', ');
  const updateVisualize = useCallback((chartId: number, nextVisualize: Visualize) => {
    setDraftCharts(currentCharts =>
      currentCharts.map(chart =>
        chart.id === chartId ? {...chart, visualize: nextVisualize} : chart
      )
    );
  }, []);
  const addDraftChart = (visualize: Visualize) => {
    setDraftCharts(currentCharts => [
      ...currentCharts,
      {
        id: currentCharts.reduce((maxId, chart) => Math.max(maxId, chart.id), -1) + 1,
        visualize,
      },
    ]);
  };
  const latestDraftPageFiltersRef = useRef(draftPageFilters);
  useEffect(() => {
    latestDraftPageFiltersRef.current = draftPageFilters;
  }, [draftPageFilters]);
  const applyChanges = () => {
    const latestDraftPageFilters = latestDraftPageFiltersRef.current;
    updateProjects(latestDraftPageFilters.projects, undefined, undefined, {
      environments: latestDraftPageFilters.environments,
      save: true,
    });
    updateEnvironments(latestDraftPageFilters.environments, undefined, undefined, {
      save: true,
    });
    updateDateTime(latestDraftPageFilters.datetime, undefined, undefined, {
      save: true,
    });
    setQueryParams({
      aggregateFields: [
        ...draftGroupBys.map(groupBy => ({groupBy})),
        ...draftVisualizes.map(visualize => visualize.serialize()),
      ],
      aggregateSortBys: draftAggregateSortBys,
      mode: draftMode,
      pageFilters: latestDraftPageFilters,
      query: draftQuery,
      sortBys: draftSampleSortBys,
    });
  };
  return (
    <CMDKChainedActionScope>
      <CMDKTerminalActionScope>
        <CMDKAction
          disabled={projectSelectionLimitExceeded}
          display={{
            label: t('Apply Changes'),
            details: projectSelectionLimitExceeded
              ? t('Select up to %s projects', PROJECT_SELECTION_COUNT_LIMIT)
              : undefined,
          }}
          keywords={['apply', 'save', 'changes']}
          onAction={applyChanges}
        />
      </CMDKTerminalActionScope>
      <SpansScopeActions
        draftPageFilters={draftPageFilters}
        setDraftPageFilters={setDraftPageFilters}
      />
      <CMDKAction display={{label: t('Commands')}}>
        {draftVisualizes.length < MAX_VISUALIZES && (
          <Fragment>
            <CMDKAction
              actionContext="add-chart"
              actionPanel={{
                context: 'add-chart',
                label: t('Add Chart'),
                order: MORE_ACTIONS_ORDER.addChart,
              }}
              display={{label: t('Add Chart')}}
              keywords={['add', 'chart', 'series', 'source', 'visualization']}
              onAction={() => addDraftChart(new VisualizeFunction(DEFAULT_VISUALIZATION))}
            />
            <CMDKAction
              actionContext="add-equation"
              actionPanel={{
                context: 'add-equation',
                label: t('Add Equation'),
                order: MORE_ACTIONS_ORDER.addEquation,
              }}
              display={{label: t('Add Equation')}}
              keywords={['add', 'chart', 'equation', 'series', 'visualization']}
              onAction={() => addDraftChart(new VisualizeEquation(EQUATION_PREFIX))}
            />
          </Fragment>
        )}
        <CMDKAction
          actionContext="group-by"
          actionPanel={{
            context: 'group-by',
            label: t('Add Group By'),
            only: true,
            order: MORE_ACTIONS_ORDER.addGroupBy,
          }}
          display={{label: t('Add Group By')}}
          keywords={['add', 'group', 'by', 'attribute']}
          onAction={addPendingGroupByRow}
        />
        <CMDKAction
          id={ADD_GROUP_BY_ACTION_ID}
          actionPanel={{
            context: 'group-by-picker',
            label: t('Choose Group By Attribute'),
            only: true,
          }}
          display={{label: t('Choose Group By Attribute')}}
          prompt={t('Search for attribute')}
        >
          <GroupByActions groupBys={draftGroupBys} onSelect={addGroupBy} />
        </CMDKAction>
        <CMDKAction
          actionContext="filter"
          actionPanel={{
            context: 'filter',
            label: t('Add Filter By'),
            only: true,
            order: MORE_ACTIONS_ORDER.addFilter,
          }}
          display={{label: t('Add Filter By')}}
          keywords={['add', 'search', 'filter', 'narrow', 'where', 'show']}
          onAction={addPendingFilterRow}
        />
        <SpansFilterActions
          addSearchFilter={addSearchFilter}
          actionPanel={{
            context: 'filter-picker',
            label: t('Choose Filter Attribute'),
            only: true,
            order: MORE_ACTIONS_ORDER.addFilter,
          }}
          filters={getFilterRows(draftQuery)}
          replaceSearchFilter={replaceSearchFilter}
        />
        {canReorderCharts(draftVisualizes) && (
          <CMDKAction
            actionContext="reorder-charts"
            actionPanel={{
              context: 'reorder-charts',
              label: t('Reorder Charts'),
              order: MORE_ACTIONS_ORDER.reorderCharts,
            }}
            display={{label: t('Reorder Charts')}}
            keywords={['reorder', 'move', 'charts', 'series']}
          >
            {draftCharts.map((chart, index) => {
              const {id: chartId, visualize} = chart;
              const id = `spans-reorder-chart-${chartId}`;

              return (
                <CMDKAction
                  key={id}
                  id={id}
                  display={{
                    label: t('Chart %s', String.fromCharCode(65 + chartId)),
                    trailingItem: (
                      <QueryValue
                        value={
                          isVisualizeEquation(visualize)
                            ? stripEquationPrefix(visualize.yAxis)
                            : visualize.yAxis
                        }
                      />
                    ),
                  }}
                  order={index}
                  onAction={() => {}}
                  onReorder={direction =>
                    setDraftCharts(currentCharts =>
                      reorderCharts(currentCharts, index, direction)
                    )
                  }
                />
              );
            })}
          </CMDKAction>
        )}
        {canCompareQueries(draftVisualizes) && (
          <CMDKAction
            disabled={hasCrossEvents}
            display={{label: t('Compare Queries')}}
            keywords={['compare', 'queries', 'charts']}
            to={generateExploreCompareRoute({
              organization,
              mode: draftMode,
              location,
              queries: draftVisualizeFunctions.map(visualize => ({
                query: draftQuery,
                groupBys: draftGroupBys,
                sortBys: draftSortBys,
                yAxes: [visualize.yAxis],
                chartType: visualize.chartType,
                caseInsensitive: caseInsensitive ? '1' : undefined,
              })),
            })}
            onAction={() =>
              trackAnalytics('trace_explorer.compare', {
                organization,
              })
            }
          />
        )}
        <SaveAsActions />
      </CMDKAction>
      <CMDKAction display={{label: t('Query')}}>
        {[...draftGroupBys, ...Array.from({length: pendingGroupByRows}, () => '')].map(
          (groupBy, index, rows) => {
            const rowId = `spans-group-by-${index}`;
            const actionContext = `group-by:${index}`;

            return (
              <Fragment key={rowId}>
                <CMDKAction
                  id={rowId}
                  actionContext={actionContext}
                  display={{
                    label: t('Group By'),
                    trailingItem: <QueryValue value={groupBy} />,
                  }}
                  keywords={['group', 'by', 'attribute', groupBy]}
                  order={QUERY_ACTION_ORDER.groupBy + index}
                  targetAction={
                    groupBy ? getChangeGroupByActionId(index) : ADD_GROUP_BY_ACTION_ID
                  }
                />
                {groupBy && (
                  <Fragment>
                    <CMDKAction
                      id={getChangeGroupByActionId(index)}
                      actionPanel={{
                        context: actionContext,
                        label: t('Change Group By Attribute'),
                        only: true,
                      }}
                      display={{label: t('Change Group By Attribute')}}
                      prompt={t('Search for attribute')}
                    >
                      <GroupByActions
                        currentGroupBy={groupBy}
                        groupBys={draftGroupBys}
                        onSelect={value => replaceGroupBy(index, value)}
                      />
                    </CMDKAction>
                    <CMDKAction
                      actionPanel={{
                        context: actionContext,
                        label: t('Clear Group By'),
                        only: true,
                      }}
                      display={{label: t('Clear Group By')}}
                      onAction={() => clearGroupBy(index)}
                    />
                  </Fragment>
                )}
                {rows.length > 1 && (
                  <CMDKAction
                    actionPanel={{
                      context: actionContext,
                      label: t('Delete Group By'),
                      only: true,
                    }}
                    display={{label: t('Delete Group By')}}
                    onAction={() => removeGroupBy(index)}
                  />
                )}
              </Fragment>
            );
          }
        )}
        <TraceItemFilterRows
          onClearFilter={clearSearchFilter}
          onDeleteFilter={removeSearchFilter}
          orderStart={QUERY_ACTION_ORDER.filter}
          pendingRows={draftFilters.pendingRows}
          summary={draftQuery}
          targetAction={(filter, index) =>
            filter && getSearchFilterDescriptor(filter)
              ? getChangeFilterValueActionId(index)
              : ADD_FILTER_ACTION_ID
          }
        />
        <CMDKAction
          id="spans-sort"
          display={{
            label: t('Sort by'),
            trailingItem: <QueryValue value={sortBySummary} />,
          }}
          order={QUERY_ACTION_ORDER.sort}
          prompt={t('Search for an attribute')}
        >
          <SortActions
            groupBys={draftGroupBys}
            mode={draftMode}
            setSortBys={setDraftSortBys}
            sortBys={draftSortBys}
            visualizes={draftVisualizes}
          />
        </CMDKAction>
      </CMDKAction>
      {draftCharts.map(({id: chartId, visualize}, index) => (
        <CMDKAction
          key={`series-details-${chartId}`}
          id={`spans-series-details-${chartId}`}
          actionContext={`chart:${chartId}`}
          display={{label: t('Chart %s', String.fromCharCode(65 + index))}}
        >
          {canDeleteChart(draftCharts) && (
            <CMDKAction
              actionPanel={{
                context: `chart:${chartId}`,
                label: t('Delete Chart'),
                only: true,
                order: MORE_ACTIONS_ORDER.deleteChart,
              }}
              display={{label: t('Delete Chart')}}
              keywords={['delete', 'remove', 'chart', 'series']}
              onAction={() =>
                setDraftCharts(currentCharts => deleteChart(currentCharts, chartId))
              }
            />
          )}
          <SeriesActions
            chartId={chartId}
            index={index}
            seriesId={`spans-series-${chartId}`}
            updateVisualize={updateVisualize}
            visualize={visualize}
            visualizes={draftVisualizes}
          />
        </CMDKAction>
      ))}
    </CMDKChainedActionScope>
  );
}

export function SpansCommandPaletteActions() {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Traces'), icon: <IconSpan />}}>
        <QueryClauseActions />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
