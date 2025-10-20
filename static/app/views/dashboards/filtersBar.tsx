import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ToggleOnDemand} from 'sentry/utils/performance/contexts/onDemandControl';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import AddFilter from 'sentry/views/dashboards/globalFilter/addFilter';
import {useDatasetSearchBarData} from 'sentry/views/dashboards/hooks/useDatasetSearchBarData';
import {useInvalidateStarredDashboards} from 'sentry/views/dashboards/hooks/useInvalidateStarredDashboards';
import {getDashboardFiltersFromURL} from 'sentry/views/dashboards/utils';

import FilterSelector from './globalFilter/filterSelector';
import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import ReleasesSelectControl from './releasesSelectControl';
import type {DashboardFilters, DashboardPermissions, GlobalFilter} from './types';
import {DashboardFilterKeys} from './types';

type FiltersBarProps = {
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
}: FiltersBarProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const getSearchBarData = useDatasetSearchBarData();

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
      <Fragment>
        <FilterButtons gap="lg">
          <ReleasesProvider organization={organization} selection={selection}>
            <ReleasesSelectControl
              handleChangeFilter={activeFilters => {
                onDashboardFilterChange({
                  ...activeFilters,
                  [DashboardFilterKeys.GLOBAL_FILTER]: activeGlobalFilters,
                });
                trackAnalytics('dashboards2.filter.change', {
                  organization,
                  filter_type: 'release',
                });
              }}
              selectedReleases={selectedReleases}
              isDisabled={isEditingDashboard}
            />
          </ReleasesProvider>

          {organization.features.includes('dashboards-global-filters') && (
            <Fragment>
              {activeGlobalFilters.map(filter => (
                <FilterSelector
                  key={filter.tag.key}
                  globalFilter={filter}
                  searchBarData={getSearchBarData(filter.dataset)}
                  onUpdateFilter={updatedFilter => {
                    updateGlobalFilters(
                      activeGlobalFilters.map(f =>
                        f.tag.key === updatedFilter.tag.key ? updatedFilter : f
                      )
                    );
                  }}
                  onRemoveFilter={removedFilter => {
                    updateGlobalFilters(
                      activeGlobalFilters.filter(f => f.tag.key !== removedFilter.tag.key)
                    );
                  }}
                />
              ))}
              <AddFilter
                globalFilters={activeGlobalFilters}
                getSearchBarData={getSearchBarData}
                onAddFilter={newFilter => {
                  updateGlobalFilters([...activeGlobalFilters, newFilter]);
                }}
              />
            </Fragment>
          )}
        </FilterButtons>
        {hasUnsavedChanges && !isEditingDashboard && !isPreview && (
          <FilterButtons gap="lg">
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
          </FilterButtons>
        )}
      </Fragment>
      <ToggleOnDemand />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  & button[aria-haspopup] {
    height: 100%;
    width: 100%;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: grid;
    grid-auto-flow: row;
  }
`;

const FilterButtons = styled(ButtonBar)`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    align-items: flex-start;
    gap: ${p => p.theme.space[p.gap!]};
  }
`;
