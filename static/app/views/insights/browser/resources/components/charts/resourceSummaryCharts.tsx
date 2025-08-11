import {Fragment} from 'react';

import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import ResourceSummaryAverageSizeChartWidget from 'sentry/views/insights/common/components/widgets/resourceSummaryAverageSizeChartWidget';
import ResourceSummaryDurationChartWidget from 'sentry/views/insights/common/components/widgets/resourceSummaryDurationChartWidget';
import ResourceSummaryThroughputChartWidget from 'sentry/views/insights/common/components/widgets/resourceSummaryThroughputChartWidget';

function ResourceSummaryCharts() {
  return (
    <Fragment>
      <ModuleLayout.Third>
        <ResourceSummaryThroughputChartWidget />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <ResourceSummaryDurationChartWidget />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <ResourceSummaryAverageSizeChartWidget />
      </ModuleLayout.Third>
    </Fragment>
  );
}

export default ResourceSummaryCharts;
