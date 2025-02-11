import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';

function WidgetBuilderFilterBar() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return (
    <PageFiltersContainer
      skipLoadLastUsed
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
        <ProjectPageFilter disabled onChange={() => {}} />
        <EnvironmentPageFilter disabled onChange={() => {}} />
        <DatePageFilter disabled onChange={() => {}} />
        <ReleasesProvider organization={organization} selection={selection}>
          <ReleasesSelectControl
            isDisabled
            handleChangeFilter={() => {}}
            selectedReleases={[]}
          />
        </ReleasesProvider>
      </PageFilterBar>
    </PageFiltersContainer>
  );
}

export default WidgetBuilderFilterBar;
