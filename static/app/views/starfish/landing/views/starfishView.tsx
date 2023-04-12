import styled from '@emotion/styled';
import {Location} from 'history';

import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {
  PerformanceWidgetSetting,
  WIDGET_DEFINITIONS,
} from 'sentry/views/starfish/landing/widgets/widgetDefinitions';
import {StackedAreaWidget} from 'sentry/views/starfish/landing/widgets/widgets/stackedAreaWidget';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';

type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  withStaticFilters: boolean;
};

export function StarfishView(props: BasePerformanceViewProps) {
  const chartSetting = PerformanceWidgetSetting.DB_HTTP_BREAKDOWN;
  const chartDefinition = WIDGET_DEFINITIONS({organization: props.organization})[
    chartSetting
  ];

  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div data-test-id="starfish-view">
        <StyledRow minSize={200}>
          <StackedAreaWidget
            eventView={props.eventView}
            organization={props.organization}
            title="Operation Breakdown"
            titleTooltip="Failure rate is the percentage of recorded transactions that had a known and unsuccessful status."
            chartHeight={180}
            fields={[
              'p95(spans.db)',
              'p95(spans.http)',
              'p95(spans.browser)',
              'p95(spans.resource)',
              'p95(spans.ui)',
            ]}
            withStaticFilters
            chartDefinition={chartDefinition}
            chartSetting={chartSetting}
            InteractiveTitle={null}
            ContainerActions={null}
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
