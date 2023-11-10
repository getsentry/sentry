import {CSSProperties} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {FieldKey} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

const excludedTags = [
  FieldKey.EVENT_TYPE,
  FieldKey.ISSUE_CATEGORY,
  FieldKey.ERROR_HANDLED,
  FieldKey.ERROR_UNHANDLED,
  FieldKey.ERROR_MAIN_THREAD,
  FieldKey.ERROR_MECHANISM,
  FieldKey.ERROR_RECEIVED,
  FieldKey.ERROR_TYPE,
  FieldKey.ERROR_VALUE,
];

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
        excludedTags={excludedTags}
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
