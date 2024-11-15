import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {User} from '@sentry/types';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ToggleOnDemand} from 'sentry/utils/performance/contexts/onDemandControl';
import {decodeList} from 'sentry/utils/queryString';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/detail';

import ReleasesSelectControl from './releasesSelectControl';
import type {DashboardFilters, DashboardPermissions} from './types';
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
  onSave?: () => void;
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
}: FiltersBarProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  let hasEditAccess = true;
  if (organization.features.includes('dashboards-edit-access')) {
    hasEditAccess = checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboardPermissions,
      dashboardCreator
    );
  }

  const selectedReleases =
    (defined(location.query?.[DashboardFilterKeys.RELEASE])
      ? decodeList(location.query[DashboardFilterKeys.RELEASE])
      : filters?.[DashboardFilterKeys.RELEASE]) ?? [];

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
        <FilterButtons>
          <ReleasesProvider organization={organization} selection={selection}>
            <ReleasesSelectControl
              handleChangeFilter={activeFilters => {
                onDashboardFilterChange(activeFilters);
                trackAnalytics('dashboards2.filter.change', {
                  organization,
                  filter_type: 'release',
                });
              }}
              selectedReleases={selectedReleases}
              isDisabled={isEditingDashboard}
            />
          </ReleasesProvider>
        </FilterButtons>
        {hasUnsavedChanges && !isEditingDashboard && !isPreview && (
          <FilterButtons>
            <Button priority="primary" onClick={onSave} disabled={!hasEditAccess}>
              {t('Save')}
            </Button>
            <Button onClick={onCancel}>{t('Cancel')}</Button>
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-auto-flow: row;
  }
`;

const FilterButtons = styled(ButtonBar)`
  display: grid;
  gap: ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: flex-start;
    gap: ${space(1.5)};
  }
`;
