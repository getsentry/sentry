import styled from '@emotion/styled';

import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';

type PercentChangeCellProps = {
  deltaValue: number;
  colorize?: boolean;
};

export function PercentChangeCell({deltaValue, colorize = true}: PercentChangeCellProps) {
  const sign = deltaValue >= 0 ? '+' : '-';
  const delta = formatPercentage(Math.abs(deltaValue), 2);
  const trendDirection = deltaValue < 0 ? 'good' : deltaValue > 0 ? 'bad' : 'neutral';

  return (
    <NumberContainer>
      <Colorized trendDirection={colorize ? trendDirection : 'neutral'}>
        {sign}
        {delta}
      </Colorized>
    </NumberContainer>
  );
}

type ColorizedProps = {
  children: React.ReactNode;
  trendDirection: 'good' | 'bad' | 'neutral';
};

const Colorized = styled('div')<ColorizedProps>`
  color: ${p =>
    p.trendDirection === 'good'
      ? p.theme.successText
      : p.trendDirection === 'bad'
      ? p.theme.errorText
      : p.theme.subText};
`;
