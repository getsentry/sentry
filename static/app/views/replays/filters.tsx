import * as React from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import space from 'sentry/styles/space';

function ReplaysFilters() {
  return (
    <StyledPageFilterBar>
      <ProjectPageFilter />
      <EnvironmentPageFilter />
      <DatePageFilter />
    </StyledPageFilterBar>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  width: max-content;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;

export default ReplaysFilters;
