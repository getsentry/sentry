import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreMode,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarMode} from 'sentry/views/explore/toolbar/toolbarMode';
import {ToolbarSaveAs} from 'sentry/views/explore/toolbar/toolbarSaveAs';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarSuggestedQueries} from 'sentry/views/explore/toolbar/toolbarSuggestedQueries';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

type Extras = 'equations' | 'tabs';

interface ExploreToolbarProps {
  extras?: Extras[];
  width?: number;
}

export function ExploreToolbar({extras, width}: ExploreToolbarProps) {
  const mode = useExploreMode();
  const setMode = useSetExploreMode();
  const fields = useExploreFields();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const sortBys = useExploreSortBys();
  const setSortBys = useSetExploreSortBys();

  return (
    <Container width={width}>
      {!extras?.includes('tabs') && <ToolbarMode mode={mode} setMode={setMode} />}
      <ToolbarVisualize equationSupport={extras?.includes('equations')} />
      {(extras?.includes('tabs') || mode === Mode.AGGREGATE) && (
        <ToolbarGroupBy autoSwitchToAggregates={extras?.includes('tabs') || false} />
      )}
      <ToolbarSortBy
        fields={fields}
        groupBys={groupBys}
        visualizes={visualizes}
        sorts={sortBys}
        setSorts={setSortBys}
      />
      <ToolbarSaveAs />
      <ToolbarSuggestedQueries />
    </Container>
  );
}

const Container = styled('div')<{width?: number}>`
  ${p => defined(p.width) && `min-width: ${p.width}px;`}
`;
