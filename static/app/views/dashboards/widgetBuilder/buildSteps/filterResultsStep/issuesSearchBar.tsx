import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {SearchBarProps} from 'sentry/components/events/searchBar';
import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  widgetQuery: WidgetQuery;
}

function IssuesSearchBar({onClose, widgetQuery, organization}: Props) {
  const onChange = useCallback<NonNullable<SearchQueryBuilderProps['onChange']>>(
    (query, state) => {
      onClose?.(query, {validSearch: state.queryIsValid});
    },
    [onClose]
  );

  return (
    <StyledIssueListSearchQueryBuilder
      searchSource="widget_builder"
      organization={organization}
      initialQuery={widgetQuery.conditions || ''}
      onChange={onChange}
      placeholder={t('Search for issues, status, assigned, and more')}
    />
  );
}

export {IssuesSearchBar};

const StyledIssueListSearchQueryBuilder = styled(IssueListSearchBar)`
  flex-grow: 1;
`;
