import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import ButtonBar from 'sentry/components/buttonBar';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import space from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Organization} from 'sentry/types/organization';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';

import ReleasesSelectControl from './releasesSelectControl';
import {DashboardFilters} from './types';

type Props = {
  filters: DashboardFilters;
  organization: Organization;
  selection: PageFilters;
  disabled?: boolean;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
};

function TopLevelFilters({
  handleChangeFilter,
  filters,
  organization,
  selection,
  disabled = false,
}: Props) {
  return (
    <Wrapper>
      <PageFilterBar condensed>
        <ProjectPageFilter disabled={disabled} />
        <EnvironmentPageFilter disabled={disabled} />
        <DatePageFilter alignDropdown="left" disabled={disabled} />
      </PageFilterBar>
      <Feature features={['dashboards-top-level-filter']}>
        <FilterButtons>
          <ReleasesProvider organization={organization} selection={selection}>
            <ReleasesSelectControl
              handleChangeFilter={handleChangeFilter}
              selectedReleases={filters?.release || []}
              isDisabled={disabled}
            />
          </ReleasesProvider>
        </FilterButtons>
      </Feature>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: min-content 1fr;
  }
`;

const FilterButtons = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: flex-start;
    gap: ${space(1.5)};
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-auto-columns: minmax(auto, 300px);
  }
`;

export default TopLevelFilters;
