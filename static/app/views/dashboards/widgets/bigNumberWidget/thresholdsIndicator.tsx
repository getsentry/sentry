import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import type {Polarity} from 'sentry/components/percentChange';

import {normalizeUnit} from '../../utils';
import type {Thresholds} from '../common/types';

interface ThresholdsIndicatorProps {
  thresholds: Thresholds;
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
  const normalizedMax1 = normalizeUnit(max1, thresholdUnit, type);
  const normalizedMax2 = normalizeUnit(max2, thresholdUnit, type);

  const state = getThresholdState(
    normalizedValue,
    normalizedMax1,
    normalizedMax2,
    preferredPolarity
  );

  const colorName = COLOR_NAME_FOR_STATE[state];

  return (
    <RigidCircleIndicator
      role="status"
      aria-label={state}
      color={theme[colorName]}
      size={12}
    />
  );
}

const RigidCircleIndicator = styled(CircleIndicator)`
  align-self: center;
  flex-shrink: 0;
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
