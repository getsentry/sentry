import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import space from 'sentry/styles/space';
import {MetricTag, Organization, Project} from 'sentry/types';

import GroupByField from './groupByField';
import SearchQueryField from './searchQueryField';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
  metricTags: MetricTag[];
  onChangeSearchQuery: (searchQuery?: string) => void;
  onChangeGroupBy: (groupBy?: string[]) => void;
  searchQuery?: string;
  groupBy?: string[];
};

function FiltersAndGroups({
  api,
  orgSlug,
  projectId,
  searchQuery,
  groupBy,
  metricTags,
  onChangeSearchQuery,
  onChangeGroupBy,
}: Props) {
  return (
    <Wrapper>
      <SearchQueryField
        api={api}
        tags={metricTags.map(({key}) => key)}
        orgSlug={orgSlug}
        projectId={projectId}
        query={searchQuery}
        onSearch={onChangeSearchQuery}
        onBlur={onChangeSearchQuery}
      />
      <GroupByField
        metricTags={metricTags}
        groupBy={groupBy}
        onChange={onChangeGroupBy}
      />
    </Wrapper>
  );
}

export default FiltersAndGroups;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr 33%;
    gap: ${space(1)};
    align-items: center;
  }
`;
