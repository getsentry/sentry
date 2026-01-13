import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import {parseAsString, useQueryState} from 'nuqs';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ToggleOnDemand} from 'sentry/utils/performance/contexts/onDemandControl';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
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
import type {ReleasesSortByOption} from 'sentry/views/insights/common/components/releasesSort';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import SortableReleasesFilter from './sortableReleasesFilter';
import type {DashboardFilters, DashboardPermissions, GlobalFilter} from './types';
import {DashboardFilterKeys} from './types';

export type FiltersBarProps = {
  filters: DashboardFilters;
  hasUnsavedChanges: boolean;
  isEditingDashboard: boolean;
  isPreview: boolean;
  location: Location;
  onDashboardFilterChange: (activeFilters: DashboardFilters) => void;
  dashboardCreator?: User;
  dashboardPermissions?: DashboardPermissions;
  onCancel?: () => void;
  onSave?: () => Promise<void>;
  prebuiltDashboardId?: PrebuiltDashboardId;
  shouldBusySaveButton?: boolean;
};

export default function FiltersBar({
  filters,
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

  // Release sort state management with Nuqs
  const [localStoragedReleaseBy, setLocalStoragedReleaseBy] =
    useLocalStorageState<ReleasesSortByOption>(
      'dashboardsReleasesSortBy',
      ReleasesSortOption.DATE
    );

  const [urlSortReleasesBy, setUrlSortReleasesBy] = useQueryState(
    'sortReleasesBy',
    parseAsString.withDefault(ReleasesSortOption.DATE)
  );

  // Use URL value if present, otherwise fall back to localStorage
  const effectiveSortBy = urlSortReleasesBy || localStoragedReleaseBy;

  // Sync localStorage with URL
  useEffect(() => {
    if (urlSortReleasesBy && urlSortReleasesBy !== localStoragedReleaseBy) {
      setLocalStoragedReleaseBy(urlSortReleasesBy as ReleasesSortByOption);
    }
  }, [urlSortReleasesBy, localStoragedReleaseBy, setLocalStoragedReleaseBy]);

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
          onChange={() => {
            trackAnalytics('dashboards2.filter.change', {
              organization,
              filter_type: 'date',
            });
          }}
        />
      </PageFilterBar>
      <SortableReleasesFilter
        sortBy={effectiveSortBy as ReleasesSortByOption}
        selectedReleases={selectedReleases}
        isDisabled={isEditingDashboard}
        handleChangeFilter={activeFilters => {
          onDashboardFilterChange({
            ...activeFilters,
            [DashboardFilterKeys.GLOBAL_FILTER]: activeGlobalFilters,
          });
        }}
        onSortChange={value => {
          setUrlSortReleasesBy(value);
          setLocalStoragedReleaseBy(value as ReleasesSortByOption);
        }}
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
