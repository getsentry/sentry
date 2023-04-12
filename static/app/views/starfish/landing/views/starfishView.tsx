import {Location} from 'history';

import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {ChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  withStaticFilters: boolean;
};

export function StarfishView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div data-test-id="starfish-view">
        <ChartRow
          chartCount={1}
          chartHeight={180}
          {...props}
          allowedCharts={[PerformanceWidgetSetting.DB_HTTP_BREAKDOWN]}
        />
        <Table {...props} setError={usePageError().setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
