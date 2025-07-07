import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BranchSelector} from 'sentry/components/codecov/branchSelector/branchSelector';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {DateSelector} from 'sentry/components/codecov/dateSelector/dateSelector';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/codecov/repoSelector/repoSelector';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
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
  const {integratedOrg, repository, branch, codecovPeriod} = useCodecovContext();

  const shouldDisplayContent = integratedOrg && repository && branch && codecovPeriod;

  return (
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
        <RepoSelector />
        <BranchSelector />
        <DateSelector />
      </PageFilterBar>
      {shouldDisplayContent ? <Content /> : <EmptySelectorsMessage />}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

function Content() {
  const location = useLocation();
  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  const response = useInfiniteTestResults();

  return (
    <Fragment>
      {/* TODO: Conditionally show these if the branch we're in is the main branch */}
      <Summaries />
      <TestAnalyticsTable response={response} sort={sorts[0]} />
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
