import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';

export default function SpanDetailsControls() {
  return (
    <FilterActions>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space(2)};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: row;
  }
`;
