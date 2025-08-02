import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {
  ALL_BRANCHES,
  BranchSelector,
} from 'sentry/components/codecov/branchSelector/branchSelector';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {DateSelector} from 'sentry/components/codecov/dateSelector/dateSelector';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/codecov/repoSelector/repoSelector';
import {TestSuiteDropdown} from 'sentry/components/codecov/testSuiteDropdown/testSuiteDropdown';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Pagination from 'sentry/components/pagination';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  useInfiniteTestResults,
  type UseInfiniteTestResultsResult,
} from 'sentry/views/codecov/tests/queries/useGetTestResults';
import {DEFAULT_SORT} from 'sentry/views/codecov/tests/settings';
import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';
import type {ValidSort} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';
import TestAnalyticsTable, {
  isAValidSort,
} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';
import {TestSearchBar} from 'sentry/views/codecov/tests/testSearchBar/testSearchBar';

function EmptySelectorsMessage() {
  return (
    <MessageContainer>
      <StyledIconSearch color="subText" size="xl" />
      <Title>{t('It looks like there is nothing to show right now.')}</Title>
      <Subtitle>
        {t('Please select a repository and branch to view Test Analytics data.')}
      </Subtitle>
    </MessageContainer>
  );
}

export default function TestsPage() {
  const {integratedOrgId, repository, branch, codecovPeriod} = useCodecovContext();
  const location = useLocation();

  const response = useInfiniteTestResults({
    cursor: location.query?.cursor as string | undefined,
    navigation: location.query?.navigation as 'next' | 'prev' | undefined,
  });
  const defaultBranch = response.data?.defaultBranch;
  const shouldDisplayTestSuiteDropdown =
    branch === ALL_BRANCHES || branch === defaultBranch;

  const shouldDisplayContent = integratedOrgId && repository && branch && codecovPeriod;

  return (
    <LayoutGap>
      <ControlsContainer>
        <PageFilterBar condensed>
          <IntegratedOrgSelector />
          <RepoSelector />
          <BranchSelector />
          <DateSelector />
        </PageFilterBar>
        {shouldDisplayTestSuiteDropdown && <TestSuiteDropdown />}
      </ControlsContainer>
      {shouldDisplayContent ? <Content response={response} /> : <EmptySelectorsMessage />}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

interface TestResultsContentData {
  response: UseInfiniteTestResultsResult;
}

function Content({response}: TestResultsContentData) {
  const location = useLocation();
  const navigate = useNavigate();
  const {branch: selectedBranch} = useCodecovContext();

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  const defaultBranch = response.data?.defaultBranch;
  const shouldDisplaySummaries =
    selectedBranch === ALL_BRANCHES || selectedBranch === defaultBranch;

  const handleCursor = useCallback(
    (
      _cursor: string | undefined,
      path: string,
      query: Record<string, any>,
      delta: number
    ) => {
      // Without these guards, the pagination cursor can get stuck on an incorrect value.
      const navigation = delta === -1 ? 'prev' : 'next';
      const goPrevPage = navigation === 'prev' && response.hasPreviousPage;
      const goNextPage = navigation === 'next' && response.hasNextPage;

      navigate({
        pathname: path,
        query: {
          ...query,
          cursor: goPrevPage
            ? response.startCursor
            : goNextPage
              ? response.endCursor
              : undefined,
          navigation,
        },
      });
    },
    [navigate, response]
  );

  return (
    <Fragment>
      {shouldDisplaySummaries && <Summaries />}
      <TestSearchBar testCount={response.totalCount} />
      <TestAnalyticsTable response={response} sort={sorts[0]} />
      {/* We don't need to use the pageLinks prop because Codecov handles pagination using our own cursor implementation. But we need to
          put a dummy value here because otherwise the component wouldn't render. */}
      <StyledPagination pageLinks="showComponent" onCursor={handleCursor} />
    </Fragment>
  );
}

const MessageContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  justify-items: center;
  align-items: center;
  text-align: center;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 14px;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${space(1)};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0px;
`;
