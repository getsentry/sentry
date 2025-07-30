import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {
  useExploreGroupBys,
  useExploreVisualizes,
  useSetExploreGroupBys,
  useSetExploreVisualizes,
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
  const visualizes = useExploreVisualizes();
  const setVisualizes = useSetExploreVisualizes();

  const groupBys = useExploreGroupBys();
  const setGroupBys = useSetExploreGroupBys();

  return (
    <Container width={width}>
      <ToolbarVisualize
        visualizes={visualizes}
        setVisualizes={setVisualizes}
        allowEquations={extras?.includes('equations') || false}
      />
      <ToolbarGroupBy groupBys={groupBys} setGroupBys={setGroupBys} />
      <ToolbarSortBy />
      <ToolbarSaveAs />
    </Container>
  );
}

const Container = styled('div')<{width?: number}>`
  ${p => defined(p.width) && `min-width: ${p.width}px;`}
`;
