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
      <PageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter alignDropdown="left" />
        <DatePageFilter alignDropdown="left" />
      </PageFilterBar>
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  width: max-content;
  max-width: 100%;
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr auto;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ReplaysFilters;
