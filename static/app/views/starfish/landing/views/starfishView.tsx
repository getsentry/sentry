import styled from '@emotion/styled';
import {Location} from 'history';

import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import WidgetContainer from '../widgets/components/widgetContainer';
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
        <StyledRow minSize={200}>
          <WidgetContainer
            allowedCharts={[PerformanceWidgetSetting.DB_HTTP_BREAKDOWN]}
            chartCount={1}
            chartHeight={180}
            eventView={props.eventView}
            location={props.location}
            key={0}
            withStaticFilters
            index={0}
            defaultChartSetting={PerformanceWidgetSetting.DB_HTTP_BREAKDOWN}
            rowChartSettings={[PerformanceWidgetSetting.DB_HTTP_BREAKDOWN]}
            setRowChartSettings={() => {}}
          />
        </StyledRow>

        <Table {...props} setError={usePageError().setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;
