import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {IconSize} from 'sentry/utils/theme';

type IconCircledNumberProps = {
  number: number;
  size?: IconSize;
};

export function IconCircledNumber({number, size = 'md'}: IconCircledNumberProps) {
  const theme = useTheme();

  return (
    <Circle
      role="img"
      size={theme.iconSizes[size]}
      aria-label={`circled number ${number}`}
    >
      <Number size={theme.iconSizes[size]}>{number}</Number>
    </Circle>
  );
}

const Circle = styled('div')<{size: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size};
  height: ${p => p.size};
  border-radius: 50%;
  border: 2px solid;
  font-weight: bold;
  text-align: center;
  line-height: 1;
  box-sizing: border-box;
`;

const Number = styled('span')<{size: string}>`
  display: block;
  font-size: calc(${p => p.size} / 2);
`;
