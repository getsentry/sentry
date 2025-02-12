import {defined} from 'sentry/utils';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';
import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {MISSING_DATA_MESSAGE, NO_PLOTTABLE_VALUES} from '../common/settings';
import type {StateProps} from '../common/types';
import {LoadingPanel} from '../widgetLayout/loadingPanel';

export interface TimeSeriesWidgetProps
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<TimeSeriesWidgetVisualizationProps> {
  visualizationType: TimeSeriesWidgetVisualizationProps['visualizationType'];
}

export function TimeSeriesWidget(props: TimeSeriesWidgetProps) {
  const {timeSeries: timeseries} = props;

  if (props.isLoading) {
    return (
      <WidgetFrame
        title={props.title}
        description={props.description}
        revealActions={props.revealActions}
        revealTooltip={props.revealTooltip}
      >
        <LoadingPanel />
      </WidgetFrame>
    );
  }

  let parsingError: string | undefined = undefined;

  if (!defined(timeseries)) {
    parsingError = MISSING_DATA_MESSAGE;
  } else if (
    timeseries.flatMap(timeSeries => timeSeries.data).every(item => item.value === null)
  ) {
    parsingError = NO_PLOTTABLE_VALUES;
  }

  // TODO: It would be polite to also scan for gaps (i.e., the items don't all
  // have the same difference in `timestamp`s) even though this is rare, since
  // the backend zerofills the

  const error = props.error ?? parsingError;

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
      revealActions={props.revealActions}
      revealTooltip={props.revealTooltip}
    >
      {defined(timeseries) && (
        <TimeSeriesWidgetVisualization
          visualizationType={props.visualizationType}
          timeSeries={timeseries}
          releases={props.releases}
          aliases={props.aliases}
          stacked={props.stacked}
          dataCompletenessDelay={props.dataCompletenessDelay}
          timeseriesSelection={props.timeseriesSelection}
          onTimeseriesSelectionChange={props.onTimeseriesSelectionChange}
        />
      )}
    </WidgetFrame>
  );
}
