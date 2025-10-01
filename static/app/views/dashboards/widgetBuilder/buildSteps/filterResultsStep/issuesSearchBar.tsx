import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {WidgetBuilderSearchBarProps} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  onClose: WidgetBuilderSearchBarProps['onClose'];
  widgetQuery: WidgetQuery;
  portalTarget?: HTMLElement | null;
}

function IssuesSearchBar({onClose, widgetQuery, portalTarget}: Props) {
  const organization = useOrganization();
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
      portalTarget={portalTarget}
    />
  );
}

export {IssuesSearchBar};

const StyledIssueListSearchQueryBuilder = styled(IssueListSearchBar)`
  flex-grow: 1;
`;
