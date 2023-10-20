import {CSSProperties} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaySearchBar from 'sentry/views/replays/list/replaySearchBar';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackSearch({className, style}: Props) {
  const {selection} = usePageFilters();
  const {pathname, query} = useLocation();
  const organization = useOrganization();

  return (
    <SearchContainer className={className} style={style}>
      <ReplaySearchBar
        placeholder={t('Search Feedback')}
        disabled
        organization={organization}
        pageFilters={selection}
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
