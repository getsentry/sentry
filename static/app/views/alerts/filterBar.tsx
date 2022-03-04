import styled from '@emotion/styled';
import {Location} from 'history';

import ButtonBar from 'sentry/components/buttonBar';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import TeamFilter from './rules/teamFilter';
import {getQueryStatus, getTeamParams} from './utils';

type Props = {
  location: Location<any>;
  onChangeFilter: (sectionId: string, activeFilters: Set<string>) => void;
  onChangeSearch: (query: string) => void;
  organization: Organization;
  hasEnvironmentFilter?: boolean;
  hasStatusFilters?: boolean;
};

function FilterBar({
  location,
  onChangeSearch,
  onChangeFilter,
  organization,
  hasEnvironmentFilter,
  hasStatusFilters,
}: Props) {
  const selectedTeams = new Set(getTeamParams(location.query.team));

  const hasPageFilters = organization.features.includes('selection-filters-v2');

  const selectedStatus = hasStatusFilters
    ? new Set(getQueryStatus(location.query.status))
    : undefined;

  return (
    <Wrapper>
      <FilterButtons gap={1.5}>
        <TeamFilter
          showStatus={hasStatusFilters}
          selectedTeams={selectedTeams}
          selectedStatus={selectedStatus}
          handleChangeFilter={onChangeFilter}
        />
        {hasPageFilters && <ProjectPageFilter />}
        {hasPageFilters && hasEnvironmentFilter && <EnvironmentPageFilter />}
      </FilterButtons>
      <SearchBar
        placeholder={t('Search by name')}
        query={location.query?.name}
        onSearch={onChangeSearch}
      />
    </Wrapper>
  );
}

export default FilterBar;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(1.5)};
`;

const FilterButtons = styled(ButtonBar)`
  grid-auto-columns: minmax(auto, 300px);
`;
