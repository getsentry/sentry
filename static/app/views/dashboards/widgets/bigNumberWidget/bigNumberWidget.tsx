import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  BigNumberWidgetVisualization,
  type BigNumberWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

import {MISSING_DATA_MESSAGE, NON_FINITE_NUMBER_MESSAGE} from '../common/settings';
import type {DataProps, StateProps} from '../common/types';

import {DEEMPHASIS_COLOR_NAME, LOADING_PLACEHOLDER} from './settings';

interface Props
  extends DataProps,
    StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Omit<BigNumberWidgetVisualizationProps, 'value' | 'previousPeriodValue'> {}

export function BigNumberWidget(props: Props) {
  const {data, previousPeriodData} = props;

  // TODO: Instrument getting more than one data key back as an error
  // e.g., with data that looks like `[{'apdex()': 0.8}] this pulls out `"apdex()"` or `undefined`
  const field = Object.keys(data?.[0] ?? {})[0];
  const value = data?.[0]?.[field];
  const previousPeriodValue = previousPeriodData?.[0]?.[field];

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
  } else if (!Number.isFinite(value) || Number.isNaN(value)) {
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
      <BigNumberResizeWrapper>
        <BigNumberWidgetVisualization
          value={Number(value)}
          previousPeriodValue={Number(previousPeriodValue)}
          field={field}
          maximumValue={props.maximumValue}
          preferredPolarity={props.preferredPolarity}
          meta={props.meta}
          thresholds={props.thresholds}
        />
      </BigNumberResizeWrapper>
    </WidgetFrame>
  );
}

const BigNumberResizeWrapper = styled('div')`
  position: relative;
  flex-grow: 1;
  margin-top: ${space(1)};
`;

const LoadingPlaceholder = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
  font-size: ${p => p.theme.fontSizeLarge};
`;
