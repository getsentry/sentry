import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';

import {SPAN_RELATIVE_PERIODS, SPAN_RETENTION_DAYS} from '../utils';

export default function SpanDetailsControls() {
  return (
    <FilterActions>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter
          relativeOptions={SPAN_RELATIVE_PERIODS}
          maxPickableDays={SPAN_RETENTION_DAYS}
        />
      </PageFilterBar>
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: row;
  }
`;
