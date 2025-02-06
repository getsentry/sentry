import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
import {SearchBarSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/search';
import {SortBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/sortBy';
import {VisualizeSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/visualize';

type Props = {
  disableDelete: boolean;
  index: number;
  query: ReadableExploreQueryParts;
};

export function QueryRow({query, index, disableDelete}: Props) {
  return (
    <QueryConstructionSection>
      <SearchBarSection query={query} index={index} />
      <DropDownGrid>
        <VisualizeSection query={query} index={index} />
        <GroupBySection query={query} index={index} />
        <SortBySection query={query} index={index} />
        <Button
          borderless
          icon={<IconDelete />}
          size="zero"
          disabled={disableDelete}
          onClick={() => {}}
          aria-label={t('Delete Query')}
        />
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
