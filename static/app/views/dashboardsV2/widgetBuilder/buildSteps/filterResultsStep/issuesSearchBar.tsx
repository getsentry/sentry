import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import {t} from 'sentry/locale';
import {SavedSearchType, TagCollection} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import useApi from 'sentry/utils/useApi';
import withIssueTags from 'sentry/utils/withIssueTags';
import {ContextualProps} from 'sentry/views/dashboardsV2/datasetConfig/base';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import {
  MAX_MENU_HEIGHT,
  MAX_SEARCH_ITEMS,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  contextualProps: ContextualProps;
  onBlur: SearchBarProps['onBlur'];
  onSearch: SearchBarProps['onSearch'];
  tags: TagCollection;
  widgetQuery: WidgetQuery;
}

function IssuesSearchBarContainer({
  tags,
  onSearch,
  onBlur,
  widgetQuery,
  contextualProps,
}: Props) {
  const api = useApi();
  const {organization, pageFilters} = contextualProps;
  function tagValueLoader(key: string, search: string) {
    const orgId = organization!.slug;
    const projectIds = pageFilters?.projects.map(id => id.toString());
    const endpointParams = {
      start: getUtcDateString(pageFilters?.datetime.start),
      end: getUtcDateString(pageFilters?.datetime.end),
      statsPeriod: pageFilters?.datetime.period,
    };

    return fetchTagValues(api, orgId, key, search, projectIds, endpointParams);
  }

  return (
    <ClassNames>
      {({css}) => (
        <StyledIssueListSearchBar
          searchSource="widget_builder"
          query={widgetQuery.conditions || ''}
          sort=""
          onSearch={onSearch}
          onBlur={onBlur}
          excludeEnvironment
          supportedTags={tags}
          placeholder={t('Search for issues, status, assigned, and more')}
          tagValueLoader={tagValueLoader}
          onSidebarToggle={() => undefined}
          maxSearchItems={MAX_SEARCH_ITEMS}
          savedSearchType={SavedSearchType.ISSUE}
          dropdownClassName={css`
            max-height: ${MAX_MENU_HEIGHT}px;
            overflow-y: auto;
          `}
        />
      )}
    </ClassNames>
  );
}

const IssuesSearchBar = withIssueTags(IssuesSearchBarContainer);

export {IssuesSearchBar};

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex-grow: 1;
  button:not([aria-label='Clear search']) {
    display: none;
  }
`;
