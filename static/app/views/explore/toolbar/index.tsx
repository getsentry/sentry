import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';

import {ToolbarGroupBy} from './toolbarGroupBy';
import {ToolbarLimitTo} from './toolbarLimitTo';
import {ToolbarResults} from './toolbarResults';
import {ToolbarSortBy} from './toolbarSortBy';
import {ToolbarVisualize} from './toolbarVisualize';

interface ExploreToolbarProps {}

export function ExploreToolbar({}: ExploreToolbarProps) {
  const [resultMode, setResultMode] = useResultMode();
  const [sampleFields] = useSampleFields();
  const [sorts, setSorts] = useSorts({fields: sampleFields});

  return (
    <div>
      <ToolbarResults resultMode={resultMode} setResultMode={setResultMode} />
      <ToolbarVisualize />
      <ToolbarSortBy fields={sampleFields} sorts={sorts} setSorts={setSorts} />
      <ToolbarLimitTo />
      <ToolbarGroupBy disabled />
    </div>
  );
}
