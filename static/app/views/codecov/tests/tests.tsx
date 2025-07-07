import styled from '@emotion/styled';

import {BranchSelector} from 'sentry/components/codecov/branchSelector/branchSelector';
import {DateSelector} from 'sentry/components/codecov/dateSelector/dateSelector';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/codecov/repoSelector/repoSelector';
import {TestSuiteDropdown} from 'sentry/components/codecov/testSuiteDropdown/testSuiteDropdown';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useInfiniteTestResults} from 'sentry/views/codecov/tests/queries/useGetTestResults';
import {DEFAULT_SORT} from 'sentry/views/codecov/tests/settings';
import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';
import type {ValidSort} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';
import TestAnalyticsTable, {
  isAValidSort,
} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

export default function TestsPage() {
  const location = useLocation();
  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  // TODO: ensure we call this hook when we have all codecov context values populated. Potentially abstract table + summaries into a new component
  const response = useInfiniteTestResults();

  return (
    <LayoutGap>
      <ControlsContainer>
        <PageFilterBar condensed>
          <IntegratedOrgSelector />
          <RepoSelector />
          <BranchSelector />
          <DateSelector />
        </PageFilterBar>
        <TestSuiteDropdown />
      </ControlsContainer>
      {/* TODO: Conditionally show these if the branch we're in is the main branch */}
      <Summaries />
      <TestAnalyticsTable response={response} sort={sorts[0]} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
