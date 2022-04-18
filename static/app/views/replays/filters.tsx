import * as React from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  handleSearchQuery: (query: string) => void;
  organization: Organization;
};

function ReplaysFilters({organization, handleSearchQuery}: Props) {
  return (
    <FilterContainer>
      <SearchContainer>
        <StyledPageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter />
        </StyledPageFilterBar>
        <SearchBar
          organization={organization}
          defaultQuery=""
          placeholder={t('Search')}
          onSearch={handleSearchQuery}
        />
      </SearchContainer>
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: grid;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const SearchContainer = styled('div')`
  display: inline-grid;
  grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: max-content;
  max-width: 100%;
`;

export default ReplaysFilters;
