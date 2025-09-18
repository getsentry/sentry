import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Pagination from 'sentry/components/pagination';
import {BranchSelector} from 'sentry/components/prevent/branchSelector/branchSelector';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {DateSelector} from 'sentry/components/prevent/dateSelector/dateSelector';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/prevent/repoSelector/repoSelector';
import {TestSuiteDropdown} from 'sentry/components/prevent/testSuiteDropdown/testSuiteDropdown';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useInfiniteTestResults} from 'sentry/views/prevent/tests/queries/useGetTestResults';
import type {UseInfiniteTestResultsResult} from 'sentry/views/prevent/tests/queries/useGetTestResults';
import {useRepo} from 'sentry/views/prevent/tests/queries/useRepo';
import {DEFAULT_SORT} from 'sentry/views/prevent/tests/settings';
import {Summaries} from 'sentry/views/prevent/tests/summaries/summaries';
import type {ValidSort} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';
import TestAnalyticsTable, {
  isAValidSort,
} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';
import {TestSearchBar} from 'sentry/views/prevent/tests/testSearchBar/testSearchBar';

export function EmptySelectorsMessage() {
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
  const {integratedOrgId, repository, branch, preventPeriod} = usePreventContext();
  const location = useLocation();
  const response = useInfiniteTestResults({
    cursor: location.query?.cursor as string | undefined,
    navigation: location.query?.navigation as 'next' | 'prev' | undefined,
  });
  const defaultBranch = response.data?.defaultBranch;
  const shouldDisplayTestSuiteDropdown = branch === null || branch === defaultBranch;

  const shouldDisplayContent = integratedOrgId && repository && preventPeriod;

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
      {shouldDisplayContent ? (
        <Content
          integratedOrgId={integratedOrgId}
          repository={repository}
          response={response}
        />
      ) : (
        <EmptySelectorsMessage />
      )}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

interface TestResultsContentData {
  integratedOrgId: string;
  repository: string;
  response: UseInfiniteTestResultsResult;
}

function Content({response, integratedOrgId, repository}: TestResultsContentData) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {branch: selectedBranch} = usePreventContext();

  const {data: repoData, isSuccess} = useRepo({
    organizationSlug: organization.slug,
    integratedOrgId,
    repository,
  });

  useEffect(() => {
    if (!repoData?.testAnalyticsEnabled && isSuccess) {
      navigate('/prevent/tests/new');
    }
  }, [repoData?.testAnalyticsEnabled, navigate, isSuccess]);

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  const defaultBranch = response.data?.defaultBranch;
  const shouldDisplaySummaries =
    selectedBranch === null || selectedBranch === defaultBranch;

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

      if (
        (navigation === 'next' && !response.hasNextPage) ||
        (navigation === 'prev' && !response.hasPreviousPage)
      ) {
        return;
      }

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
  gap: ${p => p.theme.space.xs};
  justify-items: center;
  align-items: center;
  text-align: center;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space['3xl']};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 14px;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${p => p.theme.space.md};
`;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0px;
`;
