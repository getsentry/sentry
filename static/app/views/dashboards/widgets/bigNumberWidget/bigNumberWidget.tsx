import {defined} from 'sentry/utils';
import {
  BigNumberWidgetVisualization,
  type BigNumberWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

import {DEFAULT_FIELD, MISSING_DATA_MESSAGE} from '../common/settings';
import type {StateProps} from '../common/types';

export interface BigNumberWidgetProps
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<BigNumberWidgetVisualizationProps> {}

export function BigNumberWidget(props: BigNumberWidgetProps) {
  const {value, previousPeriodValue, field} = props;

  if (props.isLoading) {
    return (
      <WidgetFrame
        title={props.title}
        description={props.description}
        borderless={props.borderless}
        revealActions={props.revealActions}
        revealTooltip={props.revealTooltip}
      >
        <BigNumberWidgetVisualization.LoadingPlaceholder />
      </WidgetFrame>
    );
  }

  let parsingError: string | undefined = undefined;

  if (!defined(value)) {
    parsingError = MISSING_DATA_MESSAGE;
  }

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
      borderless={props.borderless}
      revealActions={props.revealActions}
      revealTooltip={props.revealTooltip}
    >
      {defined(value) && (
        <BigNumberWidgetVisualization
          value={value}
          previousPeriodValue={previousPeriodValue}
          field={field ?? DEFAULT_FIELD}
          maximumValue={props.maximumValue}
          preferredPolarity={props.preferredPolarity}
          meta={props.meta}
          thresholds={props.thresholds}
        />
      )}
    </WidgetFrame>
  );
}
