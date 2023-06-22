import React from 'react';
import styled from '@emotion/styled';

import {NumberContainer} from 'sentry/utils/discover/styles';

type Props = {
  children: React.ReactNode;
  trendDirection: 'good' | 'bad' | 'neutral';
};

export function PercentChangeCell({trendDirection, children}: Props) {
  return (
    <NumberContainer>
      <Colorized trendDirection={trendDirection}>{children}</Colorized>
    </NumberContainer>
  );
}

const Colorized = styled('div')<Props>`
  color: ${p =>
    p.trendDirection === 'good'
      ? p.theme.successText
      : p.trendDirection === 'bad'
      ? p.theme.errorText
      : p.theme.subText};
`;
