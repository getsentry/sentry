import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {defined} from 'sentry/utils';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';
import type {TimeSeriesWidgetVisualizationProps} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {AreaChartWidgetVisualization} from '../areaChartWidget/areaChartWidgetVisualization';
import {BarChartWidgetVisualization} from '../barChartWidget/barChartWidgetVisualization';
import {MISSING_DATA_MESSAGE, X_GUTTER, Y_GUTTER} from '../common/settings';
import type {StateProps} from '../common/types';
import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';

type VisualizationType = 'area' | 'line' | 'bar';

export interface TimeSeriesWidgetProps
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<TimeSeriesWidgetVisualizationProps> {
  visualizationType: VisualizationType;
}

const VisualizationComponents: Record<VisualizationType, React.ComponentType<any>> = {
  area: AreaChartWidgetVisualization,
  line: LineChartWidgetVisualization,
  bar: BarChartWidgetVisualization,
};

export function TimeSeriesWidget(props: TimeSeriesWidgetProps) {
  const {timeseries} = props;

  if (props.isLoading) {
    return (
      <WidgetFrame title={props.title} description={props.description}>
        <LoadingPlaceholder>
          <LoadingMask visible />
          <LoadingIndicator mini />
        </LoadingPlaceholder>
      </WidgetFrame>
    );
  }

  let parsingError: string | undefined = undefined;

  if (!defined(timeseries)) {
    parsingError = MISSING_DATA_MESSAGE;
  }

  const error = props.error ?? parsingError;

  const Visualization = VisualizationComponents[props.visualizationType];

  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      actions={props.actions}
      actionsDisabled={props.actionsDisabled}
      actionsMessage={props.actionsMessage}
      badgeProps={props.badgeProps}
      onFullScreenViewClick={props.onFullScreenViewClick}
      warnings={props.warnings}
      error={error}
      onRetry={props.onRetry}
    >
      {defined(timeseries) && (
        <TimeSeriesWrapper>
          <Visualization
            timeseries={timeseries}
            releases={props.releases}
            aliases={props.aliases}
            dataCompletenessDelay={props.dataCompletenessDelay}
            timeseriesSelection={props.timeseriesSelection}
            onTimeseriesSelectionChange={props.onTimeseriesSelectionChange}
          />
        </TimeSeriesWrapper>
      )}
    </WidgetFrame>
  );
}

const TimeSeriesWrapper = styled('div')`
  flex-grow: 1;
  padding: 0 ${X_GUTTER} ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingPlaceholder = styled('div')`
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.background};
`;
