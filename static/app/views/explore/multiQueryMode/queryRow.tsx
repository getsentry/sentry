import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
import {SearchBarSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/search';
import {SortBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/sortBy';
import {VisualizeSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/visualize';

export function QueryRow() {
  return (
    <QueryConstructionSection>
      <SearchBarSection />
      <DropDownGrid>
        <VisualizeSection />
        <GroupBySection />
        <SortBySection />
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
