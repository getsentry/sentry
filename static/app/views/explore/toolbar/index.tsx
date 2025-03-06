import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {
  useExploreDataset,
  useExploreFields,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
  useSetExploreDataset,
  useSetExploreMode,
  useSetExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ToolbarDataset} from 'sentry/views/explore/toolbar/toolbarDataset';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarMode} from 'sentry/views/explore/toolbar/toolbarMode';
import {ToolbarSaveAs} from 'sentry/views/explore/toolbar/toolbarSaveAs';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarSuggestedQueries} from 'sentry/views/explore/toolbar/toolbarSuggestedQueries';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

type Extras = 'dataset toggle' | 'equations';

interface ExploreToolbarProps {
  extras?: Extras[];
  width?: number;
}

export function ExploreToolbar({extras, width}: ExploreToolbarProps) {
  const dataset = useExploreDataset();
  const setDataset = useSetExploreDataset();
  const mode = useExploreMode();
  const setMode = useSetExploreMode();
  const fields = useExploreFields();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const sortBys = useExploreSortBys();
  const setSortBys = useSetExploreSortBys();

  return (
    <Container width={width}>
      {extras?.includes('dataset toggle') && (
        <ToolbarDataset dataset={dataset} setDataset={setDataset} />
      )}
      <ToolbarMode mode={mode} setMode={setMode} />
      <ToolbarVisualize equationSupport={extras?.includes('equations')} />
      {mode === Mode.AGGREGATE && <ToolbarGroupBy />}
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
