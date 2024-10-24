import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {Polarity} from 'sentry/components/percentChange';

import {normalizeUnit} from '../../utils';
import {ThresholdsHoverWrapper} from '../../widgetBuilder/buildSteps/thresholdsStep/thresholdsHoverWrapper';
import type {ThresholdsConfig} from '../../widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

type ValidThresholds = {
  max_values: {
    max1: number;
    max2: number;
  };
  unit?: string;
};

interface ThresholdsIndicatorProps {
  thresholds: ValidThresholds;
  type: string;
  unit: string;
  value: number;
  preferredPolarity?: Polarity;
}

export function ThresholdsIndicator({
  thresholds,
  value,
  type,
  preferredPolarity = '+',
  unit: valueUnit,
}: ThresholdsIndicatorProps) {
  const theme = useTheme();

  const {max_values, unit: thresholdUnit} = thresholds;
  const {max1, max2} = max_values;

  const normalizedValue = normalizeUnit(value, valueUnit, type);
  const normalizedMax1 = thresholdUnit ? normalizeUnit(max1, thresholdUnit, type) : max1;
  const normalizedMax2 = thresholdUnit ? normalizeUnit(max2, thresholdUnit, type) : max2;

  const state = getThresholdState(
    normalizedValue,
    normalizedMax1,
    normalizedMax2,
    preferredPolarity
  );

  const colorName = COLOR_NAME_FOR_STATE[state];

  const thresholdsConfig: ThresholdsConfig = {
    unit: thresholdUnit ?? null,
    max_values: {
      max1: max1 ?? null,
      max2: max2 ?? null,
    },
  };

  return (
    <ThresholdsHoverWrapper thresholds={thresholdsConfig} type={type}>
      <Circle role="status" aria-label={state} color={theme[colorName]} />
    </ThresholdsHoverWrapper>
  );
}

const Circle = styled('div')<{color: string}>`
  display: inline-block;
  height: clamp(12px, 20cqh, 50px);
  width: clamp(12px, 20cqh, 50px);

  position: relative;
  align-self: center;
  flex-shrink: 0;

  border-radius: 50%;
  background: ${p => p.color};
`;

type ThresholdState = 'poor' | 'meh' | 'good';

const COLOR_NAME_FOR_STATE: Record<ThresholdState, string> = {
  poor: 'red300',
  meh: 'yellow300',
  good: 'green300',
};

function getThresholdState(
  value: number,
  max1: number,
  max2: number,
  preferredPolarity: Polarity
): string {
  const [belowMax1, belowMax2, aboveMax2] =
    preferredPolarity === '+' ? ['poor', 'meh', 'good'] : ['good', 'meh', 'poor'];

  if (value <= max1) {
    return belowMax1;
  }

  if (value <= max2) {
    return belowMax2;
  }

  return aboveMax2;
}
