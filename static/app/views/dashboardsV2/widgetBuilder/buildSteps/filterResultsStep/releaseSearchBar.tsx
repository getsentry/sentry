import styled from '@emotion/styled';

import {SearchBarProps} from 'sentry/components/events/searchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {Organization} from 'sentry/types';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import MetricsSearchBar from 'sentry/views/performance/metricsSearchBar';

interface Props {
  onBlur: SearchBarProps['onBlur'];
  onSearch: SearchBarProps['onSearch'];
  organization: Organization;
  projectIds: SearchBarProps['projectIds'];
  query: WidgetQuery;
}

export function ReleaseSearchBar({
  organization,
  query,
  projectIds,
  onSearch,
  onBlur,
}: Props) {
  return (
    <SearchBar
      searchSource="widget_builder"
      orgSlug={organization.slug}
      query={query.conditions}
      maxQueryLength={MAX_QUERY_LENGTH}
      projectIds={projectIds ?? []}
      onSearch={onSearch}
      onBlur={onBlur}
    />
  );
}

const SearchBar = styled(MetricsSearchBar)`
  flex-grow: 1;
`;
