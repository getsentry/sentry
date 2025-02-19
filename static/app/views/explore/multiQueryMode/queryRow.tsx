import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  getQueryMode,
  type ReadableExploreQueryParts,
  useDeleteQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
import {SearchBarSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/search';
import {SortBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/sortBy';
import {VisualizeSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/visualize';
import {MultiQueryModeChart} from 'sentry/views/explore/multiQueryMode/queryVisualizations/chart';
import {MultiQueryTable} from 'sentry/views/explore/multiQueryMode/queryVisualizations/table';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
  totalQueryRows: number;
};

export function QueryRow({query: queryParts, index, totalQueryRows}: Props) {
  const deleteQuery = useDeleteQueryAtIndex();

  const {groupBys} = queryParts;
  const mode = getQueryMode(groupBys);

  return (
    <Fragment>
      <QueryConstructionSection>
        <SearchBarSection query={queryParts} index={index} />
        <DropDownGrid>
          <VisualizeSection query={queryParts} index={index} />
          <GroupBySection query={queryParts} index={index} />
          <SortBySection query={queryParts} index={index} />
          <DeleteButton
            borderless
            icon={<IconDelete />}
            size="zero"
            disabled={totalQueryRows === 1}
            onClick={() => deleteQuery(index)}
            aria-label={t('Delete Query')}
          />
        </DropDownGrid>
      </QueryConstructionSection>
      <QueryVisualizationSection>
        <MultiQueryModeChart index={index} mode={mode} query={queryParts} />
        <MultiQueryTable confidences={[]} mode={mode} query={queryParts} index={index} />
      </QueryVisualizationSection>
    </Fragment>
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
  grid-template-columns: repeat(3, minmax(0, auto)) ${space(2)};
  align-items: start;
  gap: ${space(2)};
`;

const DeleteButton = styled(Button)`
  margin-top: ${space(4)};
`;

const QueryVisualizationSection = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  margin-bottom: ${space(1)};
  gap: ${space(2)};
`;
