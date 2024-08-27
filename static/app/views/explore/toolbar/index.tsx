import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {ToolbarDataset} from 'sentry/views/explore/toolbar/toolbarDataset';
import {ToolbarGroupBy} from 'sentry/views/explore/toolbar/toolbarGroupBy';
import {ToolbarLimitTo} from 'sentry/views/explore/toolbar/toolbarLimitTo';
import {ToolbarResults} from 'sentry/views/explore/toolbar/toolbarResults';
import {ToolbarSortBy} from 'sentry/views/explore/toolbar/toolbarSortBy';
import {ToolbarVisualize} from 'sentry/views/explore/toolbar/toolbarVisualize';

import {useVisualize} from '../hooks/useVisualize';

type Extras = 'dataset toggle';

interface ExploreToolbarProps {
  extras?: Extras[];
}

export function ExploreToolbar({extras}: ExploreToolbarProps) {
  const [dataset, setDataset] = useDataset();
  const [resultMode, setResultMode] = useResultMode();
  const [sampleFields] = useSampleFields();
  const [sorts, setSorts] = useSorts({fields: sampleFields});
  const [visualize, setVisualize] = useVisualize();

  return (
    <div>
      {extras?.includes('dataset toggle') && (
        <ToolbarDataset dataset={dataset} setDataset={setDataset} />
      )}
      <ToolbarResults resultMode={resultMode} setResultMode={setResultMode} />
      <ToolbarVisualize visualize={visualize} setVisualize={setVisualize} />
      <ToolbarSortBy fields={sampleFields} sorts={sorts} setSorts={setSorts} />
      <ToolbarLimitTo />
      <ToolbarGroupBy disabled />
    </div>
  );
}
