import {useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import {IconClock} from '@sentry/icons/clock';
import {IconTimer} from '@sentry/icons/timer';
import type {Location} from 'history';
import {createParser, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  DEFAULT_RELEASES_SORT,
  RELEASES_SORT_OPTIONS,
  ReleasesSortOption,
} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {NavigationTypeSwitcher} from 'sentry/views/insights/browser/webVitals/navigationType/navigationTypeSwitcher';
import {
  hidesNavigationTypeChip,
  showsNavigationTypeSwitcher,
  useNavigationTypeExperiment,
} from 'sentry/views/insights/browser/webVitals/navigationType/utils';

import {AddFilter} from './globalFilter/addFilter';
import {GenericFilterSelector} from './globalFilter/genericFilterSelector';
import {
  getTagKeysInMultipleDatasets,
  globalFilterKeysAreEqual,
  globalFiltersAreEqual,
  mergeGlobalFilters,
} from './globalFilter/utils';
import {useDashboardChartInterval} from './hooks/useDashboardChartInterval';
import {useDashboardMaxPickableDays} from './hooks/useDashboardMaxPickableDays';
import {
  enqueueDashboardWrite,
  isSavedDashboardId,
  useDashboardQueryPriority,
  useSaveDashboardQueryPriority,
} from './hooks/useDashboardQueryPriority';
import {useDatasetSearchBarData} from './hooks/useDatasetSearchBarData';
import {useInvalidateStarredDashboards} from './hooks/useInvalidateStarredDashboards';
import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {
  getPrebuiltDashboardConfig,
  type PrebuiltDashboardId,
} from './utils/prebuiltConfigs';
import {DataSet} from './widgetBuilder/utils';
import {SortableReleasesSelect} from './sortableReleasesSelect';
import type {
  DashboardDetails,
  DashboardFilters,
  DashboardPermissions,
  DashboardQueryPriority,
  GlobalFilter,
} from './types';
import {DashboardFilterKeys} from './types';
import {getDashboardFiltersFromURL} from './utils';

export type FiltersBarProps = {
  filters: DashboardFilters;
  hasUnsavedChanges: boolean;
  isEditingDashboard: boolean;
  isPreview: boolean;
  location: Location;
  onDashboardFilterChange: (activeFilters: DashboardFilters) => void;
  dashboard?: DashboardDetails;
  dashboardCreator?: User;
  dashboardPermissions?: DashboardPermissions;
  onAddWidget?: (dataset: DataSet, openWidgetTemplates?: boolean) => void;
  onCancel?: () => void;
  onDashboardQueryPrioritySaved?: (dashboard: DashboardDetails) => void;
  onSave?: () => Promise<void>;
  prebuiltDashboardId?: PrebuiltDashboardId;
  shouldBusySaveButton?: boolean;
  storageNamespace?: string;
  widgetLimitReached?: boolean;
};

export function FiltersBar({
  filters,
  dashboard,
  dashboardPermissions,
  dashboardCreator,
  hasUnsavedChanges,
  isEditingDashboard,
  isPreview,
  location,
  onCancel,
  onDashboardFilterChange,
  onDashboardQueryPrioritySaved,
  onSave,
  shouldBusySaveButton,
  prebuiltDashboardId,
  storageNamespace,
}: FiltersBarProps) {
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const {getSearchBarData, onFilterKeySearch} = useDatasetSearchBarData();
  const isPrebuiltDashboard = defined(prebuiltDashboardId);
  const prebuiltDashboardFilters = prebuiltDashboardId
    ? (getPrebuiltDashboardConfig(prebuiltDashboardId, organization).filters
        .globalFilter ?? [])
    : [];

  const maxPickableDaysOptions = useDashboardMaxPickableDays(dashboard?.widgets);

  // Release sort state - validates and defaults to DATE via custom parser
  const [releaseSort, setReleaseSort] = useQueryState('sortReleasesBy', parseReleaseSort);

  // Reset sort to default if ADOPTION is selected but environment requirement isn't met
  const {selection} = usePageFilters();
  const {environments} = selection;
  useEffect(() => {
    if (releaseSort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
      setReleaseSort(DEFAULT_RELEASES_SORT);
    }
  }, [releaseSort, environments.length, setReleaseSort]);

  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboardPermissions,
    dashboardCreator
  );

  const invalidateStarredDashboards = useInvalidateStarredDashboards();
  const dashboardFiltersFromURL = getDashboardFiltersFromURL(location);

  const selectedReleases =
    dashboardFiltersFromURL?.[DashboardFilterKeys.RELEASE] ??
    filters?.[DashboardFilterKeys.RELEASE] ??
    [];

  const [activeGlobalFilters, setActiveGlobalFilters] = useState<GlobalFilter[]>(() => {
    const savedFilters = filters?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [];
    const initialFilters =
      savedFilters.length > 0 ? savedFilters : prebuiltDashboardFilters;
    const urlFilters = dashboardFiltersFromURL?.[DashboardFilterKeys.GLOBAL_FILTER];

    if (!urlFilters) {
      return initialFilters;
    }

    // Empty array means user explicitly cleared all filters — respect that
    if (urlFilters.length === 0) {
      return urlFilters;
    }

    const nonOverlapping = initialFilters.filter(
      saved => !urlFilters.some(url => globalFilterKeysAreEqual(saved, url))
    );

    return [...nonOverlapping, ...urlFilters];
  });

  // Sync merged filters to the URL on mount so widgets see the same filters
  // as the filter bar. Without this, the filter bar shows merged [saved + URL]
  // filters but widgets only query with raw URL filters.
  useEffect(() => {
    const urlFilters = dashboardFiltersFromURL?.[DashboardFilterKeys.GLOBAL_FILTER];

    // Only sync if URL has non-empty filters AND saved filters were merged in
    if (
      urlFilters &&
      urlFilters.length > 0 &&
      activeGlobalFilters.length > urlFilters.length
    ) {
      onDashboardFilterChange({
        [DashboardFilterKeys.RELEASE]: selectedReleases,
        [DashboardFilterKeys.GLOBAL_FILTER]: activeGlobalFilters,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // this ensures that when the global filters url is updated from external
    // components, the global filter selector displays the correct filter values
    const urlFilters = dashboardFiltersFromURL?.[DashboardFilterKeys.GLOBAL_FILTER];
    if (urlFilters && urlFilters.length > 0) {
      for (const filter of urlFilters) {
        if (!activeGlobalFilters.some(f => globalFiltersAreEqual(f, filter))) {
          // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
          setActiveGlobalFilters(mergeGlobalFilters(activeGlobalFilters, urlFilters));
        }
      }
    }
  }, [activeGlobalFilters, dashboardFiltersFromURL]);

  const updateGlobalFilters = (newGlobalFilters: GlobalFilter[]) => {
    setActiveGlobalFilters(newGlobalFilters);
    onDashboardFilterChange({
      [DashboardFilterKeys.RELEASE]: selectedReleases,
      [DashboardFilterKeys.GLOBAL_FILTER]: newGlobalFilters,
    });
  };

  const hasTemporaryFilters = activeGlobalFilters.some(filter => filter.isTemporary);

  // The insights route omits `prebuiltDashboardId`, since passing it would
  // surface the prebuilt chips there, so fall back to the dashboard's own ID.
  const {isEnabled: isNavigationTypeExperimentEnabled} = useNavigationTypeExperiment(
    prebuiltDashboardId ?? dashboard?.prebuiltId
  );
  const isNavigationTypeSwitcherShown = showsNavigationTypeSwitcher(
    activeGlobalFilters,
    organization,
    isNavigationTypeExperimentEnabled
  );
  const visibleGlobalFilters = activeGlobalFilters.filter(
    filter =>
      !hidesNavigationTypeChip(filter, organization, isNavigationTypeSwitcherShown)
  );
  const tagKeysInMultipleDatasets = getTagKeysInMultipleDatasets(visibleGlobalFilters);

  const [chartInterval, setChartInterval, intervalOptions] = useDashboardChartInterval();
  const {
    enabled: showQueryPriority,
    options: queryPriorityOptions,
    priority,
    setPriority,
  } = useDashboardQueryPriority(dashboard?.queryPriority);
  const {mutateAsync: saveQueryPriority} = useSaveDashboardQueryPriority();
  // Bumps when the selection is replaced, so an older request does not start
  // or update the page. Unmount is separate: the write still goes out, but
  // its result must not land on whatever page is open now.
  const queryPrioritySaveId = useRef(0);
  const queryPriorityUnmounted = useRef(false);
  useEffect(
    () => () => {
      queryPriorityUnmounted.current = true;
    },
    []
  );
  const handleQueryPriorityChange = (value: DashboardQueryPriority) => {
    const previous = priority;
    setPriority(value);
    // Viewers can still change the selection for this visit. Only an editor
    // of a saved dashboard writes it back.
    if (!hasEditAccess || isPreview || !dashboard || !isSavedDashboardId(dashboard.id)) {
      return;
    }
    // Compare the selection the user already sees. Props can still hold the
    // previous saved value after a save finishes, and using them would skip
    // the write that puts the old value back.
    if (previous === value) {
      return;
    }
    const saveId = ++queryPrioritySaveId.current;
    const dashboardId = dashboard.id;
    enqueueDashboardWrite(async () => {
      if (saveId !== queryPrioritySaveId.current) {
        return;
      }
      try {
        const updated = await saveQueryPriority({dashboardId, queryPriority: value});
        if (
          updated &&
          saveId === queryPrioritySaveId.current &&
          !queryPriorityUnmounted.current
        ) {
          onDashboardQueryPrioritySaved?.(updated);
        }
      } catch {
        // The mutation already reports the error. Put the dropdown back only
        // when the failed selection is still the one on screen.
        if (saveId === queryPrioritySaveId.current && !queryPriorityUnmounted.current) {
          setPriority(previous);
        }
      }
    });
  };
  const queryPriorityLabel =
    queryPriorityOptions.find(option => option.value === priority)?.label ??
    t('Balanced Querying');
  return (
    <Flex
      align={{zero: 'stretch', xl: 'start'}}
      direction={{zero: 'column', xl: 'row'}}
      wrap="wrap"
      gap="lg"
      marginBottom="0"
      padding="lg xl xl"
    >
      <Flex
        css={css`
          & button[aria-haspopup] {
            height: 100%;
            width: 100%;
          }
        `}
        direction="row"
        flex={{zero: '0 1 auto', xl: `1 1 ${FILTERS_ROW_FLEX_BASIS_PX}px`}}
        gap="lg"
        minWidth={0}
        wrap="wrap"
      >
        <PageFilterBar condensed>
          <ProjectPageFilter
            disabled={isEditingDashboard}
            storageNamespace={storageNamespace}
            onChange={() => {
              trackAnalytics('dashboards2.filter.change', {
                organization,
                filter_type: 'project',
              });
            }}
          />
          <EnvironmentPageFilter
            disabled={isEditingDashboard}
            storageNamespace={storageNamespace}
            onChange={() => {
              trackAnalytics('dashboards2.filter.change', {
                organization,
                filter_type: 'environment',
              });
            }}
          />
          <DatePageFilter
            disabled={isEditingDashboard}
            maxPickableDays={maxPickableDaysOptions.maxPickableDays}
            onChange={() => {
              trackAnalytics('dashboards2.filter.change', {
                organization,
                filter_type: 'date',
              });
            }}
          />
        </PageFilterBar>
        <SortableReleasesSelect
          sortBy={releaseSort}
          selectedReleases={selectedReleases}
          isDisabled={isEditingDashboard}
          handleChangeFilter={activeFilters => {
            onDashboardFilterChange({
              ...activeFilters,
              [DashboardFilterKeys.GLOBAL_FILTER]: activeGlobalFilters,
            });
          }}
          onSortChange={setReleaseSort}
        />
        {isNavigationTypeSwitcherShown && (
          <NavigationTypeSwitcher
            globalFilters={activeGlobalFilters}
            onChange={updateGlobalFilters}
          />
        )}
        {visibleGlobalFilters.map(filter => (
          <GenericFilterSelector
            disableRemoveFilter={
              isPrebuiltDashboard &&
              prebuiltDashboardFilters.some(
                prebuiltFilter =>
                  prebuiltFilter.tag.key === filter.tag.key &&
                  prebuiltFilter.dataset === filter.dataset
              )
            }
            key={`${filter.tag.key}:${filter.dataset}:${filter.value}`}
            globalFilter={filter}
            showDatasetLabel={tagKeysInMultipleDatasets.has(filter.tag.key)}
            searchBarData={getSearchBarData(filter.dataset)}
            onUpdateFilter={updatedFilter => {
              updateGlobalFilters(
                activeGlobalFilters.map(f =>
                  globalFilterKeysAreEqual(f, updatedFilter) ? updatedFilter : f
                )
              );
            }}
            onRemoveFilter={removedFilter => {
              updateGlobalFilters(
                activeGlobalFilters.filter(
                  f => !globalFilterKeysAreEqual(f, removedFilter)
                )
              );
              trackAnalytics('dashboards2.global_filter.remove', {
                organization,
              });
            }}
          />
        ))}
        <AddFilter
          globalFilters={activeGlobalFilters}
          getSearchBarData={getSearchBarData}
          onFilterKeySearch={onFilterKeySearch}
          onAddFilter={newFilter => {
            updateGlobalFilters([...activeGlobalFilters, newFilter]);
            trackAnalytics('dashboards2.global_filter.add', {
              organization,
            });
          }}
        />
        {!hasTemporaryFilters &&
          hasUnsavedChanges &&
          !isEditingDashboard &&
          !isPreview && (
            <Grid flow="column" align="center" gap="md">
              <Button
                tooltipProps={{
                  title:
                    !hasEditAccess &&
                    t('You do not have permission to edit this dashboard'),
                }}
                variant="primary"
                onClick={async () => {
                  await onSave?.();
                  invalidateStarredDashboards();
                }}
                disabled={!hasEditAccess}
                busy={shouldBusySaveButton}
              >
                {isPrebuiltDashboard ? t('Save for Everyone') : t('Save')}
              </Button>
              <Button
                data-test-id="filter-bar-cancel"
                onClick={() => {
                  onCancel?.();
                  // Reset local display state, falling back to prebuilt
                  // defaults when no saved filters exist
                  const displayFilters = filters.globalFilter?.length
                    ? filters.globalFilter
                    : prebuiltDashboardFilters;
                  setActiveGlobalFilters(displayFilters);
                  // Push saved filters (not display fallback) to avoid a
                  // URL/DB mismatch that re-triggers hasUnsavedFilterChanges
                  onDashboardFilterChange(filters);
                }}
              >
                {t('Cancel')}
              </Button>
            </Grid>
          )}
      </Flex>
      <Grid flow="column" align="center" gap="md">
        {showQueryPriority && (
          <CompactSelect
            value={priority}
            onChange={option => handleQueryPriorityChange(option.value)}
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                icon={<IconTimer />}
                aria-label={t('Query Speed: %s', queryPriorityLabel)}
              >
                {queryPriorityLabel}
              </OverlayTrigger.Button>
            )}
            menuTitle={t('Query Speed')}
            menuWidth={240}
            options={queryPriorityOptions}
          />
        )}
        <CompactSelect
          value={chartInterval}
          onChange={option => setChartInterval(option.value)}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} icon={<IconClock />} />
          )}
          menuTitle={t('Interval')}
          options={intervalOptions}
        />
      </Grid>
    </Flex>
  );
}

const parseReleaseSort = createParser({
  parse: (value: string): ReleasesSortOption => {
    if (value in RELEASES_SORT_OPTIONS) {
      return value as ReleasesSortOption;
    }
    return DEFAULT_RELEASES_SORT;
  },
  serialize: (value: ReleasesSortOption): string => value,
}).withDefault(DEFAULT_RELEASES_SORT);

// Filters row starts wrapping siblings at this width.
const FILTERS_ROW_FLEX_BASIS_PX = 480;
