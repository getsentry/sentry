import styled from '@emotion/styled';

import CodecovProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {DatePicker} from 'sentry/components/codecov/datePicker/datePicker';
import {RepoPicker} from 'sentry/components/codecov/repoPicker/repoPicker';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {space} from 'sentry/styles/space';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import TestsOnboardingPage from 'sentry/views/codecov/tests/onboarding';
import {DEFAULT_SORT} from 'sentry/views/codecov/tests/settings';
import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';
import type {ValidSort} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';
import TestAnalyticsTable, {
  isAValidSort,
} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

const DEFAULT_CODECOV_DATETIME_SELECTION = {
  start: null,
  end: null,
  utc: false,
  period: '24h',
};

// TODO: Sorting will only work once this is connected to the API
const fakeApiResponse = {
  data: [
    {
      testName:
        'tests.symbolicator.test_unreal_full.SymbolicatorUnrealIntegrationTest::test_unreal_crash_with_attachments',
      averageDurationMs: 4,
      flakeRate: 0.4,
      commitsFailed: 1,
      lastRun: '2025-04-17T22:26:19.486793+00:00',
      isBrokenTest: false,
    },
    {
      testName:
        'graphql_api/tests/test_owner.py::TestOwnerType::test_fetch_current_user_is_not_okta_authenticated',
      averageDurationMs: 4370,
      flakeRate: 0,
      commitsFailed: 5,
      lastRun: '2025-04-16T22:26:19.486793+00:00',
      isBrokenTest: true,
    },
    {
      testName: 'graphql_api/tests/test_owner.py',
      averageDurationMs: 10032,
      flakeRate: 1,
      commitsFailed: 3,
      lastRun: '2025-02-16T22:26:19.486793+00:00',
      isBrokenTest: false,
    },
  ],
  isLoading: false,
  isError: false,
};

export default function TestsPage() {
  const location = useLocation();

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];

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
      <CodecovProvider>
        <PageFilterBar condensed>
          <RepoPicker />
        </PageFilterBar>
        {/* TODO: Conditionally show these if the branch we're in is the main branch */}
        <Summaries />
        <TestAnalyticsTable response={fakeApiResponse} sort={sorts[0]} />
        <TestsOnboardingPage />
      </CodecovProvider>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
