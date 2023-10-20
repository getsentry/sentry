import {useState} from 'react';

import {MetricDisplayType} from 'sentry/utils/metrics';
import {MetricWidget, MetricWidgetProps} from 'sentry/views/ddm/widget';

// TODO(ddm): move this to admin
export default function MetricsExplorer() {
  const [widget, setWidget] = useState<MetricWidgetProps>({
    mri: '',
    op: undefined,
    query: '',
    groupBy: [],
    displayType: MetricDisplayType.LINE,
    position: 0,
    powerUserMode: true,
    showSummaryTable: true,
    onChange: () => {},
    sort: {name: 'name', order: 'asc'},
  });

  return (
    <MetricWidget
      widget={{
        ...widget,
        onChange: data => {
          setWidget(curr => ({...curr, ...data}));
        },
      }}
      datetime={{
        start: null,
        end: null,
        period: '7d',
        utc: false,
      }}
      projects={[]}
      environments={[]}
    />
  );
}
