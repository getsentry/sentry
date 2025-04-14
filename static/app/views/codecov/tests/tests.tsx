import styled from '@emotion/styled';

import {DatePicker} from 'sentry/components/codecov/datePicker/datePicker';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {space} from 'sentry/styles/space';

export const DEFAULT_CODECOV_DATETIME_SELECTION = {
  start: null,
  end: null,
  utc: false,
  period: '24h',
};

export default function TestsPage() {
  return (
    <LayoutGap>
      <p>Test Analytics</p>
      <PageFiltersContainer
        defaultSelection={{datetime: DEFAULT_CODECOV_DATETIME_SELECTION}}
      >
        <PageFilterBar condensed>
          <DatePicker />
        </PageFilterBar>
      </PageFiltersContainer>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
