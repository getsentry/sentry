import {CSSProperties} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackSearch({className, style}: Props) {
  const {pathname, query} = useLocation();
  const organization = useOrganization();

  return (
    <SearchContainer className={className} style={style}>
      <IssueListSearchBar
        placeholder={t('Search Feedback')}
        organization={organization}
        defaultSearchGroup={undefined}
        defaultQuery=""
        query={decodeScalar(query.query, '')}
        onSearch={searchQuery => {
          browserHistory.push({
            pathname,
            query: {
              ...query,
              cursor: undefined,
              query: searchQuery.trim(),
            },
          });
        }}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: grid;
  width: 100%;
`;
