import {useMemo} from 'react';

import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {ToolbarDataset} from 'sentry/views/explore/toolbar/toolbarDataset';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarLimitTo} from 'sentry/views/explore/toolbar/toolbarLimitTo';
import {ToolbarResults} from 'sentry/views/explore/toolbar/toolbarResults';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

type Extras = 'dataset toggle';

interface ExploreToolbarProps {
  extras?: Extras[];
}

export function ExploreToolbar({extras}: ExploreToolbarProps) {
  const [dataset, setDataset] = useDataset();
  const [resultMode, setResultMode] = useResultMode();

  const [sampleFields] = useSampleFields();

  const [groupBys] = useGroupBys();
  const [visualizes] = useVisualizes();

  const fields = useMemo(() => {
    if (resultMode === 'samples') {
      return sampleFields;
    }
    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [resultMode, sampleFields, groupBys, visualizes]);

  const [sorts, setSorts] = useSorts({fields});

  return (
    <div>
      {extras?.includes('dataset toggle') && (
        <ToolbarDataset dataset={dataset} setDataset={setDataset} />
      )}
      <ToolbarResults resultMode={resultMode} setResultMode={setResultMode} />
      <ToolbarVisualize />
      <ToolbarGroupBy disabled={resultMode !== 'aggregate'} />
      <ToolbarSortBy fields={fields} sorts={sorts} setSorts={setSorts} />
      <ToolbarLimitTo />
    </div>
  );
}
