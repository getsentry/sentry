import styled from '@emotion/styled';

import {defined} from 'sentry/utils';
import {
  BigNumberWidgetVisualization,
  type BigNumberWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

import {
  DEFAULT_FIELD,
  MISSING_DATA_MESSAGE,
  NON_FINITE_NUMBER_MESSAGE,
  X_GUTTER,
  Y_GUTTER,
} from '../common/settings';
import type {StateProps} from '../common/types';

import {DEEMPHASIS_COLOR_NAME, LOADING_PLACEHOLDER} from './settings';

interface Props
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<BigNumberWidgetVisualizationProps> {}

export function BigNumberWidget(props: Props) {
  const {value, previousPeriodValue, field} = props;

  if (props.isLoading) {
    return (
      <WidgetFrame title={props.title} description={props.description}>
        <LoadingPlaceholder>{LOADING_PLACEHOLDER}</LoadingPlaceholder>
      </WidgetFrame>
    );
  }

  let parsingError: string | undefined = undefined;

  if (!defined(value)) {
    parsingError = MISSING_DATA_MESSAGE;
  } else if (
    (typeof value === 'number' && !Number.isFinite(value)) ||
    Number.isNaN(value)
  ) {
    parsingError = NON_FINITE_NUMBER_MESSAGE;
  }

  const error = props.error ?? parsingError;

  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      actions={props.actions}
      error={error}
      onRetry={props.onRetry}
    >
      {defined(value) && (
        <BigNumberResizeWrapper>
          <BigNumberWidgetVisualization
            value={value}
            previousPeriodValue={previousPeriodValue}
            field={field ?? DEFAULT_FIELD}
            maximumValue={props.maximumValue}
            preferredPolarity={props.preferredPolarity}
            meta={props.meta}
            thresholds={props.thresholds}
          />
        </BigNumberResizeWrapper>
      )}
    </WidgetFrame>
  );
}

const BigNumberResizeWrapper = styled('div')`
  position: relative;
  flex-grow: 1;
`;

const LoadingPlaceholder = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
  padding: ${X_GUTTER} ${Y_GUTTER};
  font-size: ${p => p.theme.fontSizeLarge};
`;
