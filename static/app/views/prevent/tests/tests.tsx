import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {BranchSelector} from 'sentry/components/prevent/branchSelector/branchSelector';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {DateSelector} from 'sentry/components/prevent/dateSelector/dateSelector';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/prevent/repoSelector/repoSelector';
import {TestSuiteDropdown} from 'sentry/components/prevent/testSuiteDropdown/testSuiteDropdown';
import {getPreventParamsString} from 'sentry/components/prevent/utils';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeSorts} from 'sentry/utils/queryString';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import TestsPreOnboardingPage from 'sentry/views/prevent/tests/preOnboarding';
import {useGetActiveIntegratedOrgs} from 'sentry/views/prevent/tests/queries/useGetActiveIntegratedOrgs';
import {
  useInfiniteTestResults,
  type UseInfiniteTestResultsResult,
} from 'sentry/views/prevent/tests/queries/useGetTestResults';
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
      <StyledIconSearch variant="muted" size="xl" />
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
  const organization = useOrganization();
  const shouldDisplayContent = integratedOrgId && repository && preventPeriod;

  const {data: integrations = [], isPending: isIntegrationsPending} =
    useGetActiveIntegratedOrgs({organization});
  const regionData = getRegionDataFromOrganization(organization);
  const isUSStorage = regionData?.name?.toLowerCase() === 'us';

  let mainContent: React.ReactNode;
  if (isIntegrationsPending) {
    mainContent = <LoadingIndicator />;
  } else if (integrations.length === 0) {
    mainContent = <TestsPreOnboardingPage />;
  } else if (shouldDisplayContent) {
    mainContent = <Content response={response} />;
  } else {
    mainContent = <EmptySelectorsMessage />;
  }

  if (!isUSStorage) {
    return (
      <Grid gap="xl">
        <TestsPreOnboardingPage />
      </Grid>
    );
  }

  return (
    <Grid gap="xl">
      <ControlsContainer>
        <PageFilterBar condensed>
          <IntegratedOrgSelector />
          <RepoSelector />
          <BranchSelector />
          <DateSelector />
        </PageFilterBar>
        {shouldDisplayTestSuiteDropdown && <TestSuiteDropdown />}
      </ControlsContainer>
      {mainContent}
    </Grid>
  );
}

interface TestResultsContentData {
  response: UseInfiniteTestResultsResult;
}

function Content({response}: TestResultsContentData) {
  const location = useLocation();
  const navigate = useNavigate();
  const {branch: selectedBranch} = usePreventContext();
  const {data: repoData, isSuccess: isRepoSuccess} = useRepo();

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  const defaultBranch = response.data?.defaultBranch;
  const shouldDisplaySummaries =
    selectedBranch === null || selectedBranch === defaultBranch;

  const handleCursor = useCallback(
    (delta: number) => {
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
        query: {
          ...location.query,
          cursor: goPrevPage
            ? response.startCursor
            : goNextPage
              ? response.endCursor
              : undefined,
          navigation,
        },
      });
    },
    [navigate, response, location.query]
  );

  const cameFromOnboardingRoute = location.state?.from === '/prevent/tests/new';

  useEffect(() => {
    if (!cameFromOnboardingRoute && !repoData?.testAnalyticsEnabled && isRepoSuccess) {
      const queryString = getPreventParamsString(location);
      navigate(`/prevent/tests/new${queryString ? `?${queryString}` : ''}`, {
        state: {from: '/prevent/tests'},
        replace: true,
      });
    }
    // No `location` dependency as it causes infinite loop of redirect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameFromOnboardingRoute, repoData?.testAnalyticsEnabled, isRepoSuccess, navigate]);

  if (!cameFromOnboardingRoute && !repoData?.testAnalyticsEnabled && isRepoSuccess) {
    return null;
  }

  return (
    <Fragment>
      {shouldDisplaySummaries && <Summaries />}
      <TestSearchBar testCount={response.totalCount} />
      <div>
        <TestAnalyticsTable response={response} sort={sorts[0]} />
        <Flex justify="right">
          <ButtonBar merged gap="0">
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={!response.hasPreviousPage}
              onClick={() => handleCursor(-1)}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="sm"
              disabled={!response.hasNextPage}
              onClick={() => handleCursor(1)}
            />
          </ButtonBar>
        </Flex>
      </div>
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
  border-radius: ${p => p.theme.radius.md};
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
