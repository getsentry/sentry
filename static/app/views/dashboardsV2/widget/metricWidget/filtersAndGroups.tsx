import styled from '@emotion/styled';

import {Client} from 'app/api';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

import GroupByField from './groupByField';
import SearchQueryField from './searchQueryField';

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
  metricTags: string[];
  onChangeSearchQuery: (searchQuery?: string) => void;
  onChangeGroupBy: (groupBy?: string[]) => void;
  searchQuery?: string;
  groupBy?: string[];
};

function FiltersAndGroups({
  api,
  orgSlug,
  projSlug,
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
        tags={metricTags}
        orgSlug={orgSlug}
        projectSlug={projSlug}
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
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr 33%;
    grid-gap: ${space(1)};
    align-items: center;
  }
`;
