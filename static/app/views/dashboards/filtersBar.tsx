import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import {createParser, useQueryState} from 'nuqs';

import {Button, ButtonBar} from '@sentry/scraps/button';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  DEFAULT_RELEASES_SORT,
  RELEASES_SORT_OPTIONS,
  ReleasesSortOption,
} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ToggleOnDemand} from 'sentry/utils/performance/contexts/onDemandControl';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import AddFilter from 'sentry/views/dashboards/globalFilter/addFilter';
import GenericFilterSelector from 'sentry/views/dashboards/globalFilter/genericFilterSelector';
import {globalFilterKeysAreEqual} from 'sentry/views/dashboards/globalFilter/utils';
import {useDatasetSearchBarData} from 'sentry/views/dashboards/hooks/useDatasetSearchBarData';
import {useInvalidateStarredDashboards} from 'sentry/views/dashboards/hooks/useInvalidateStarredDashboards';
import {getDashboardFiltersFromURL} from 'sentry/views/dashboards/utils';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {SortableReleasesSelect} from './sortableReleasesSelect';
import type {
  DashboardDetails,
  DashboardFilters,
  DashboardPermissions,
  GlobalFilter,
  Widget,
} from './types';
import {DashboardFilterKeys, WidgetType} from './types';

/**
 * Maps widget types to data categories for determining max pickable days
 */
function getDataCategoriesFromWidgets(
  widgets: Widget[]
): [DataCategory, ...DataCategory[]] {
  const categories = new Set<DataCategory>();

  for (const widget of widgets) {
    const widgetType = widget.widgetType ?? WidgetType.DISCOVER;

    switch (widgetType) {
      case WidgetType.SPANS:
        categories.add(DataCategory.SPANS);
        break;
      case WidgetType.TRANSACTIONS:
        categories.add(DataCategory.TRANSACTIONS);
        break;
      case WidgetType.TRACEMETRICS:
        categories.add(DataCategory.TRACE_METRICS);
        break;
      case WidgetType.LOGS:
        categories.add(DataCategory.LOG_ITEM);
        break;
      case WidgetType.ERRORS:
      case WidgetType.DISCOVER:
      case WidgetType.ISSUE:
      case WidgetType.RELEASE:
      case WidgetType.METRICS:
      default:
        // For error-like widgets, use TRANSACTIONS as a safe default
        // since it has the most permissive date range
        categories.add(DataCategory.TRANSACTIONS);
        break;
    }
  }

  // Return as tuple with at least one element (required by useMaxPickableDays)
  const categoriesArray = Array.from(categories);
  return categoriesArray.length > 0
    ? (categoriesArray as [DataCategory, ...DataCategory[]])
    : [DataCategory.TRANSACTIONS];
}

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
  onCancel?: () => void;
  onSave?: () => Promise<void>;
  prebuiltDashboardId?: PrebuiltDashboardId;
  shouldBusySaveButton?: boolean;
};

export default function FiltersBar({
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
  onSave,
  shouldBusySaveButton,
  prebuiltDashboardId,
}: FiltersBarProps) {
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const getSearchBarData = useDatasetSearchBarData();
  const isPrebuiltDashboard = defined(prebuiltDashboardId);
  const prebuiltDashboardFilters: GlobalFilter[] = prebuiltDashboardId
    ? (PREBUILT_DASHBOARDS[prebuiltDashboardId].filters.globalFilter ?? [])
    : [];

  // Determine data categories based on widget types in the dashboard
  const dataCategories = useMemo(() => {
    if (!dashboard?.widgets || dashboard.widgets.length === 0) {
      // Default to TRANSACTIONS if no widgets
      return [DataCategory.TRANSACTIONS] as [DataCategory, ...DataCategory[]];
    }

    return getDataCategoriesFromWidgets(dashboard.widgets);
  }, [dashboard?.widgets]);

  // Calculate maxPickableDays based on the data categories
  const maxPickableDaysOptions = useMaxPickableDays({dataCategories});

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
    return (
      dashboardFiltersFromURL?.[DashboardFilterKeys.GLOBAL_FILTER] ??
      filters?.[DashboardFilterKeys.GLOBAL_FILTER] ??
      []
    );
  });

  const updateGlobalFilters = (newGlobalFilters: GlobalFilter[]) => {
    setActiveGlobalFilters(newGlobalFilters);
    onDashboardFilterChange({
      [DashboardFilterKeys.RELEASE]: selectedReleases,
      [DashboardFilterKeys.GLOBAL_FILTER]: newGlobalFilters,
    });
  };

  const hasTemporaryFilters = activeGlobalFilters.some(filter => filter.isTemporary);

  return (
    <Wrapper>
      <PageFilterBar condensed>
        <ProjectPageFilter
          disabled={isEditingDashboard}
          onChange={() => {
            trackAnalytics('dashboards2.filter.change', {
              organization,
              filter_type: 'project',
            });
          }}
        />
        <EnvironmentPageFilter
          disabled={isEditingDashboard}
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
      {organization.features.includes('dashboards-global-filters') && (
        <Fragment>
          {activeGlobalFilters.map(filter => (
            <GenericFilterSelector
              disableRemoveFilter={
                isPrebuiltDashboard &&
                prebuiltDashboardFilters.some(
                  prebuiltFilter =>
                    prebuiltFilter.tag.key === filter.tag.key &&
                    prebuiltFilter.dataset === filter.dataset
                )
              }
              key={filter.tag.key + filter.value}
              globalFilter={filter}
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
            onAddFilter={newFilter => {
              updateGlobalFilters([...activeGlobalFilters, newFilter]);
              trackAnalytics('dashboards2.global_filter.add', {
                organization,
              });
            }}
          />
        </Fragment>
      )}
      {!hasTemporaryFilters &&
        hasUnsavedChanges &&
        !isEditingDashboard &&
        !isPreview &&
        !isPrebuiltDashboard && (
          <ButtonBar>
            <Button
              title={
                !hasEditAccess && t('You do not have permission to edit this dashboard')
              }
              priority="primary"
              onClick={async () => {
                await onSave?.();
                invalidateStarredDashboards();
              }}
              disabled={!hasEditAccess}
              busy={shouldBusySaveButton}
            >
              {t('Save')}
            </Button>
            <Button
              data-test-id="filter-bar-cancel"
              onClick={() => {
                onCancel?.();
                setActiveGlobalFilters(filters.globalFilter ?? []);
                onDashboardFilterChange(filters);
              }}
            >
              {t('Cancel')}
            </Button>
          </ButtonBar>
        )}
      <ToggleOnDemand />
    </Wrapper>
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

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;

  & button[aria-haspopup] {
    height: 100%;
    width: 100%;
  }
`;
