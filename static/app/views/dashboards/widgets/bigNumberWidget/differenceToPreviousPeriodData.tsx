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
import {NO_DATA_PLACEHOLDER} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import type {TableData} from 'sentry/views/dashboards/widgets/common/types';

interface Props {
  data: TableData;
  field: string;
  formatter: (datum: TableData[number]) => React.ReactNode;
  previousPeriodData: TableData;
  preferredPolarity?: Polarity;
}

export function DifferenceToPreviousPeriodData({
  data,
  previousPeriodData,
  preferredPolarity = '',
  field,
  formatter,
}: Props) {
  const currentValue = data[0][field];
  const previousValue = previousPeriodData[0][field];

  if (!isNumber(currentValue) || !isNumber(previousValue)) {
    return <Deemphasize>{NO_DATA_PLACEHOLDER}</Deemphasize>;
  }

  const difference = currentValue - previousValue;
  const polarity = getPolarity(difference);
  const rating = getPolarityRating(polarity, preferredPolarity);

  const directionMarker = getDifferenceDirectionMarker(difference);

  // Create a fake data row so we can pass it to field renderers. Omit the +/- sign since the direction marker will indicate it
  const differenceAsDatum = {
    [field]: Math.abs(difference),
  };

  return (
    <Difference rating={rating}>
      <Indicator>{directionMarker}</Indicator>
      <Number>{formatter(differenceAsDatum)}</Number>
    </Difference>
  );
}

const Difference = styled(ColorizedRating)`
  display: flex;
  gap: ${space(0.5)};

  @container (min-height: 50px) {
    padding-bottom: 5cqh;
  }
`;

const Number = styled('div')`
  font-size: clamp(14px, calc(10px + 4cqi), 30cqh);
`;

const Indicator = styled('div')`
  font-size: clamp(14px, calc(10px + 4cqi), 30cqh);
`;

const Deemphasize = styled('span')`
  color: ${p => p.theme.gray300};
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
