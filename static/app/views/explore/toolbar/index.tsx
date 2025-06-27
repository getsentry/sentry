import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {
  useExploreFields,
  useExploreGroupBys,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarSaveAs} from 'sentry/views/explore/toolbar/toolbarSaveAs';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

type Extras = 'equations';

interface ExploreToolbarProps {
  extras?: Extras[];
  width?: number;
}

export function ExploreToolbar({extras, width}: ExploreToolbarProps) {
  const fields = useExploreFields();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const sortBys = useExploreSortBys();
  const setSortBys = useSetExploreSortBys();

  return (
    <Container width={width}>
      <ToolbarVisualize allowEquations={extras?.includes('equations') || false} />
      <ToolbarGroupBy autoSwitchToAggregates />
      <ToolbarSortBy
        fields={fields}
        groupBys={groupBys}
        visualizes={visualizes}
        sorts={sortBys}
        setSorts={setSortBys}
      />
      <ToolbarSaveAs />
    </Container>
  );
}

const Container = styled('div')<{width?: number}>`
  ${p => defined(p.width) && `min-width: ${p.width}px;`}
`;
