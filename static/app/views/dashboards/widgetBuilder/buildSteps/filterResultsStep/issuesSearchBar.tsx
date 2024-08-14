import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import type {SearchBarProps} from 'sentry/components/events/searchBar';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  onClose: SearchBarProps['onClose'];
  organization: Organization;
  widgetQuery: WidgetQuery;
}

function IssuesSearchBar({onClose, widgetQuery, organization}: Props) {
  if (organization.features.includes('issue-stream-search-query-builder')) {
    return (
      <StyledIssueListSearchQueryBuilder
        searchSource="widget_builder"
        organization={organization}
        query={widgetQuery.conditions || ''}
        onClose={onClose}
        placeholder={t('Search for issues, status, assigned, and more')}
      />
    );
  }

  return (
    <ClassNames>
      {({css}) => (
        <StyledIssueListSearchBar
          searchSource="widget_builder"
          organization={organization}
          query={widgetQuery.conditions || ''}
          onClose={onClose}
          placeholder={t('Search for issues, status, assigned, and more')}
          maxSearchItems={MAX_SEARCH_ITEMS}
          dropdownClassName={css`
            max-height: ${MAX_MENU_HEIGHT}px;
            overflow-y: auto;
          `}
        />
      )}
    </ClassNames>
  );
}

export {IssuesSearchBar};

const StyledIssueListSearchQueryBuilder = styled(IssueListSearchBar)`
  flex-grow: 1;
`;

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex-grow: 1;
  button:not([aria-label='Clear search']) {
    display: none;
  }
`;
