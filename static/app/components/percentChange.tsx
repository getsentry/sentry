import styled from '@emotion/styled';

import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  colorize?: boolean;
  minimumValue?: number;
  preferredPolarity?: Polarity;
}

export type Polarity = '+' | '-' | '';

type Rating = 'good' | 'bad' | 'neutral';

export function PercentChange({
  value,
  colorize = true,
  preferredPolarity = '+',
  minimumValue,
  ...props
}: Props) {
  const polarity = getPolarity(value);
  const rating = getPolarityRating(polarity, preferredPolarity);

  return (
    <NumberContainer {...props}>
      <ColorizedRating rating={colorize ? rating : 'neutral'} data-rating={rating}>
        {polarity}
        {formatPercentage(Math.abs(value), 2, {minimumValue})}
      </ColorizedRating>
    </NumberContainer>
  );
}

function getPolarity(value: number): Polarity {
  if (value > 0) {
    return '+';
  }

  if (value < 0) {
    return '-';
  }

  return '';
}

function getPolarityRating(polarity: Polarity, preferredPolarity: Polarity): Rating {
  if (polarity === preferredPolarity) {
    return 'good';
  }

  if (polarity !== preferredPolarity) {
    return 'bad';
  }

  return 'neutral';
}

const ColorizedRating = styled('div')<{
  rating: Rating;
}>`
  color: ${p =>
    p.rating === 'good'
      ? p.theme.successText
      : p.rating === 'bad'
        ? p.theme.errorText
        : p.theme.subText};
`;
