import styled from '@emotion/styled';
import isNumber from 'lodash/isNumber';

import {
  ColorizedRating,
  getPolarity,
  getPolarityRating,
  type Polarity,
} from 'sentry/components/percentChange';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {
  DEEMPHASIS_COLOR_NAME,
  LOADING_PLACEHOLDER,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import type {TableData} from 'sentry/views/dashboards/widgets/common/types';

import {DEFAULT_FIELD} from '../common/settings';

interface DifferenceToPreviousPeriodValueProps {
  previousPeriodValue: number;
  renderer: (datum: TableData[number]) => React.ReactNode;
  value: number;
  field?: string;
  preferredPolarity?: Polarity;
}

export function DifferenceToPreviousPeriodValue({
  value: currentValue,
  previousPeriodValue: previousValue,
  preferredPolarity = '',
  field = DEFAULT_FIELD,
  renderer,
}: DifferenceToPreviousPeriodValueProps) {
  if (!isNumber(currentValue) || !isNumber(previousValue)) {
    return <Deemphasize>{LOADING_PLACEHOLDER}</Deemphasize>;
  }

  const difference = currentValue - previousValue;
  const polarity = getPolarity(difference);
  const rating = getPolarityRating(polarity, preferredPolarity);

  const directionMarker = getDifferenceDirectionMarker(difference);

  // Create a fake data row so we can pass it to field renderers. Omit the +/- sign since the direction marker will indicate it
  const differenceAsDatum = {
    [field ?? 'unknown']: Math.abs(difference),
  };

  return (
    <Difference rating={rating}>
      <Text>{directionMarker}</Text>
      <Text>{renderer(differenceAsDatum)}</Text>
    </Difference>
  );
}

const Difference = styled(ColorizedRating)`
  display: flex;
  gap: ${space(0.25)};
  margin-bottom: 6cqh;

  @container (min-height: 50px) {
    margin-bottom: 10cqh;
  }
`;

const Text = styled('div')`
  font-size: 14px;

  @container (min-height: 50px) {
    font-size: clamp(14px, calc(10px + 4cqi), 30cqh);
  }
`;

const Deemphasize = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
`;

function getDifferenceDirectionMarker(difference: number) {
  if (difference > 0) {
    return <IconArrow direction="up" size="xs" />;
  }

  if (difference < 0) {
    return <IconArrow direction="down" size="xs" />;
  }

  return null;
}
