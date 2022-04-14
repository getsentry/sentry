import * as React from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import space from 'sentry/styles/space';

function ReplaysFilters() {
  return (
    <FilterContainer>
      <SearchContainer>
        <PageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter alignDropdown="left" />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
      </SearchContainer>
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: grid;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const SearchContainer = styled('div')<{
  hasPageFilters?: boolean;
}>`
  display: inline-grid;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  ${p =>
    p.hasPageFilters
      ? `grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);`
      : `
    @media (min-width: ${p.theme.breakpoints[0]}) {
      grid-template-columns: 1fr auto;
    }
  }`}

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ReplaysFilters;
