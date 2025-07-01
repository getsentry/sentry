import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {IntegratedOrgSelector} from 'sentry/components/codecov/integratedOrgSelector/integratedOrgSelector';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import type {ValidSort} from './repoTokenTable/repoTokenTable';
import RepoTokenTable, {
  DEFAULT_SORT,
  isAValidSort,
} from './repoTokenTable/repoTokenTable';

export default function TokensPage() {
  const {integratedOrg} = useCodecovContext();
  const location = useLocation();

  const sorts: [ValidSort] = [
    decodeSorts(location.query?.sort).find(isAValidSort) ?? DEFAULT_SORT,
  ];

  const response = {
    data: [
      {
        name: 'test',
        token: 'test',
        createdAt: 'Mar 20, 2024 6:33:30 PM CET',
      },
      {
        name: 'test2',
        token: 'test2',
        createdAt: 'Mar 19, 2024 6:33:30 PM CET',
      },
    ],
    isLoading: false,
    error: null,
  };

  return (
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
      </PageFilterBar>
      <HeaderValue>{t('Repository tokens')}</HeaderValue>
      <p>
        {t('View the list of tokens created for your repositories in')}{' '}
        <strong>{integratedOrg}</strong>.{' '}
        {t("Use them for uploading reports to all Sentry Prevent's features.")}
      </p>
      <RepoTokenTable response={response} sort={sorts[0]} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(1)};
  max-width: 1200px;
`;

const HeaderValue = styled('div')`
  margin-top: ${space(4)};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
