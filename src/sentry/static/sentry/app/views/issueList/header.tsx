import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import QueryCount from 'app/components/queryCount';
import * as Layout from 'app/components/layouts/thirds';

type Props = {
  query: string;
  queryCount: number;
  queryMaxCount: number;
  onTabChange: (query: string) => void;
};

const queries = [
  ['is:inbox', t('Inbox')],
  ['is:unresolved', t('Backlog')],
  ['is:ignored', t('Ignored')],
  ['is:resolved', t('Resolved')],
];

function IssueListHeader({query, queryCount, queryMaxCount, onTabChange}: Props) {
  const count = <StyledQueryCount count={queryCount} max={queryMaxCount} />;

  return (
    <React.Fragment>
      <BorderlessHeader>
        <StyledHeaderContent>
          <StyledLayoutTitle>{t('Issues')}</StyledLayoutTitle>
        </StyledHeaderContent>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          {queries.map(([tabQuery, queryName]) => (
            <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
              <a onClick={() => onTabChange(tabQuery)}>
                {queryName} {query === tabQuery && count}
              </a>
            </li>
          ))}
        </Layout.HeaderNavTabs>
      </TabLayoutHeader>
    </React.Fragment>
  );
}

export default IssueListHeader;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
`;

const StyledQueryCount = styled(QueryCount)`
  color: ${p => p.theme.gray500};
`;
