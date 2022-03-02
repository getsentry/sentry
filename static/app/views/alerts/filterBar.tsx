import styled from '@emotion/styled';
import {Location} from 'history';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import TeamFilter from './rules/teamFilter';
import {getQueryStatus, getTeamParams} from './utils';

type Props = {
  location: Location<any>;
  onChangeFilter: (sectionId: string, activeFilters: Set<string>) => void;
  onChangeSearch: (query: string) => void;
  hasStatusFilters?: boolean;
};

function FilterBar({location, hasStatusFilters, onChangeSearch, onChangeFilter}: Props) {
  const selectedTeams = new Set(getTeamParams(location.query.team));

  const selectedStatus = hasStatusFilters
    ? new Set(getQueryStatus(location.query.status))
    : undefined;

  return (
    <Wrapper>
      <TeamFilter
        showStatus={hasStatusFilters}
        selectedTeams={selectedTeams}
        selectedStatus={selectedStatus}
        handleChangeFilter={onChangeFilter}
      />
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
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(1.5)};
`;
