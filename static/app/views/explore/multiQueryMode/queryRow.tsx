import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
import {SearchBarSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/search';
import {SortBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/sortBy';
import {VisualizeSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/visualize';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function QueryRow({query, index}: Props) {
  return (
    <QueryConstructionSection>
      <SearchBarSection query={query} index={index} />
      <DropDownGrid>
        <VisualizeSection query={query} index={index} />
        <GroupBySection query={query} index={index} />
        <SortBySection query={query} index={index} />
      </DropDownGrid>
    </QueryConstructionSection>
  );
}

const QueryConstructionSection = styled('div')`
  display: grid;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(400px, 1fr) 1fr;
    margin-bottom: 0;
    gap: ${space(2)};
  }
`;

const DropDownGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 0;
  gap: ${space(2)};
`;
