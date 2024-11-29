import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';

type WidgetBuilderFilterBarProps = {
  organization: Organization;
  selection: PageFilters;
};

function WidgetBuilderFilterBar({organization, selection}: WidgetBuilderFilterBarProps) {
  return (
    <PageFiltersContainer
      disablePersistence
      defaultSelection={{
        datetime: {
          start: null,
          end: null,
          utc: false,
          period: DEFAULT_STATS_PERIOD,
        },
      }}
    >
      <PageFilterBar>
        <ProjectPageFilter onChange={() => {}} />
        <EnvironmentPageFilter onChange={() => {}} />
        <DatePageFilter onChange={() => {}} />
        <ReleasesProvider organization={organization} selection={selection}>
          <ReleasesSelectControl handleChangeFilter={() => {}} selectedReleases={[]} />
        </ReleasesProvider>
      </PageFilterBar>
    </PageFiltersContainer>
  );
}

export default WidgetBuilderFilterBar;
