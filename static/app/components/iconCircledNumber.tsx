import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {IconSize} from 'sentry/utils/theme';

type IconCircledNumberProps = {
  number: number;
  size?: IconSize;
};

export function IconCircledNumber({number, size = 'md'}: IconCircledNumberProps) {
  const theme = useTheme();
  const numericSize = theme.iconNumberSizes[size];

  return (
    <Circle size={numericSize} role="img" aria-label={`circled number ${number}`}>
      <Number size={numericSize}>{number}</Number>
    </Circle>
  );
}

const Circle = styled('div')<{size: number}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  border: 2px solid;
  font-weight: bold;
  text-align: center;
  line-height: 1;
  box-sizing: border-box;
`;

const Number = styled('span')<{size: number}>`
  display: block;
  font-size: ${p => p.size / 2}px;
`;
