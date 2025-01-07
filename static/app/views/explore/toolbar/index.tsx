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
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarSuggestedQueries} from 'sentry/views/explore/toolbar/toolbarSuggestedQueries';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

type Extras = 'dataset toggle';

interface ExploreToolbarProps {
  extras?: Extras[];
}

export function ExploreToolbar({extras}: ExploreToolbarProps) {
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
    <div>
      {extras?.includes('dataset toggle') && (
        <ToolbarDataset dataset={dataset} setDataset={setDataset} />
      )}
      <ToolbarMode mode={mode} setMode={setMode} />
      <ToolbarVisualize />
      <ToolbarGroupBy disabled={mode !== Mode.AGGREGATE} />
      <ToolbarSortBy
        fields={fields}
        groupBys={groupBys}
        visualizes={visualizes}
        sorts={sortBys}
        setSorts={setSortBys}
      />
      <ToolbarSuggestedQueries />
    </div>
  );
}
