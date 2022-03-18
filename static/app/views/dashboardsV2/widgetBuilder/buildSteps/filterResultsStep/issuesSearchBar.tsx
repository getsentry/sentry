import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import {Organization, PageFilters, TagCollection} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import useApi from 'sentry/utils/useApi';
import withIssueTags from 'sentry/utils/withIssueTags';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

interface Props {
  onBlur: SearchBarProps['onBlur'];
  onSearch: SearchBarProps['onSearch'];
  organization: Organization;
  query: WidgetQuery;
  selection: PageFilters;
  tags: TagCollection;
  searchSource?: string;
}

function IssuesSearchBar({
  tags,
  onSearch,
  onBlur,
  organization,
  query,
  selection,
  searchSource,
}: Props) {
  const api = useApi();
  function tagValueLoader(key: string, search: string) {
    const orgId = organization.slug;
    const projectIds = selection.projects.map(id => id.toString());
    const endpointParams = {
      start: getUtcDateString(selection.datetime.start),
      end: getUtcDateString(selection.datetime.end),
      statsPeriod: selection.datetime.period,
    };

    return fetchTagValues(api, orgId, key, search, projectIds, endpointParams);
  }

  return (
    <StyledIssueListSearchBar
      searchSource={searchSource}
      organization={organization}
      query={query.conditions || ''}
      sort=""
      onSearch={onSearch}
      onBlur={onBlur}
      excludeEnvironment
      supportedTags={tags}
      tagValueLoader={tagValueLoader}
      onSidebarToggle={() => undefined}
    />
  );
}

export default withIssueTags(IssuesSearchBar);

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex-grow: 1;
  button:not([aria-label='Clear search']) {
    display: none;
  }
`;
