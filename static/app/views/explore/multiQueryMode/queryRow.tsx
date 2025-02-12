import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type ReadableExploreQueryParts,
  useDeleteQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
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
  const deleteQuery = useDeleteQueryAtIndex();
  return (
    <QueryConstructionSection>
      <SearchBarSection query={query} index={index} />
      <DropDownGrid>
        <VisualizeSection query={query} index={index} />
        <GroupBySection query={query} index={index} />
        <SortBySection query={query} index={index} />
        <DeleteButton
          borderless
          icon={<IconDelete />}
          size="zero"
          disabled={disableDelete}
          onClick={() => deleteQuery(index)}
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
  grid-template-columns: repeat(3, minmax(0, auto)) ${space(2)};
  align-items: start;
  gap: ${space(2)};
`;

const DeleteButton = styled(Button)`
  margin-top: ${space(4)};
`;
