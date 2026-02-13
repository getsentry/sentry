import {Container} from '@sentry/scraps/layout';

import {
  useQueryParamsGroupBys,
  useQueryParamsVisualizes,
  useSetQueryParamsGroupBys,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
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
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  return (
    <Container
      data-test-id="explore-span-toolbar"
      minWidth={typeof width === 'undefined' ? undefined : `${width}px`}
    >
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
