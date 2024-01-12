import {useState} from 'react';

import {MRI} from 'sentry/types';
import {MetricDisplayType, MetricWidgetQueryParams} from 'sentry/utils/metrics';
import {MetricWidget} from 'sentry/views/ddm/widget';

// TODO(ddm): move this to admin
export default function MetricsExplorer() {
  const [widget, setWidget] = useState<MetricWidgetQueryParams>({
    mri: '' as MRI,
    op: undefined,
    query: '',
    groupBy: [],
    displayType: MetricDisplayType.LINE,
    powerUserMode: true,
    showSummaryTable: true,
    sort: {name: 'name', order: 'asc'},
    title: undefined,
  });

  return (
    <MetricWidget
      widget={{
        ...widget,
      }}
      isSelected={false}
      onSelect={() => {}}
      onChange={(_, data) => {
        setWidget(curr => ({...curr, ...data}));
      }}
      index={0}
      datetime={{
        start: null,
        end: null,
        period: '7d',
        utc: false,
      }}
      projects={[]}
      environments={[]}
      hasSiblings={false}
      addFocusArea={() => {}}
      removeFocusArea={() => {}}
      focusArea={null}
    />
  );
}
