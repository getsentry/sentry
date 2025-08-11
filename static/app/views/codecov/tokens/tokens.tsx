import {useCallback} from 'react';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import {integratedOrgIdToName} from 'sentry/components/codecov/integratedOrgSelector/utils';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {useInfiniteRepositoryTokens} from './repoTokenTable/hooks/useInfiniteRepositoryTokens';
import type {ValidSort} from './repoTokenTable/repoTokenTable';
import RepoTokenTable, {
  DEFAULT_SORT,
  isAValidSort,
} from './repoTokenTable/repoTokenTable';

export default function TokensPage() {
  const {integratedOrgId} = useCodecovContext();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {data: integrations = []} = useApiQuery<Integration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );
  const location = useLocation();

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];
  const response = useInfiniteRepositoryTokens({
    cursor: location.query?.cursor as string | undefined,
    navigation: location.query?.navigation as 'next' | 'prev' | undefined,
  });

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
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
      </PageFilterBar>
      <HeaderValue>{t('Repository tokens')}</HeaderValue>
      <p>
        {t('View the list of tokens created for your repositories in')}{' '}
        <strong>{integratedOrgIdToName(integratedOrgId, integrations)}</strong>.{' '}
        {t("Use them for uploading reports to all Sentry Prevent's features.")}
      </p>
      <RepoTokenTable response={response} sort={sorts[0]} />
      {/* We don't need to use the pageLinks prop because Codecov handles pagination using our own cursor implementation. But we need to
          put a dummy value here because otherwise the component wouldn't render. */}
      <StyledPagination pageLinks="showComponent" onCursor={handleCursor} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(1)};
  max-width: 1000px;
`;

const HeaderValue = styled('div')`
  margin-top: ${space(4)};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0px;
`;
