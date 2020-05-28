import React from 'react';
import styled from '@emotion/styled';

import {Color} from 'app/utils/theme';

type Props = {
  children: React.ReactNode;
  color: NonNullable<Color | React.CSSProperties['color']>;
  borderColor?: Color | React.CSSProperties['color'];
  isNumeric?: boolean;
};

const Badge = ({children, ...props}: Props) => <Wrapper {...props}>{children}</Wrapper>;

export default Badge;

const Wrapper = styled('div', {
  shouldForwardProp: prop =>
    prop !== 'color' && prop !== 'isNumeric' && prop !== 'borderColor',
})<Props>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: ${p => p.theme.white};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  border-radius: 32px;
  z-index: 1;
  position: relative;
  color: ${p => p.theme[p.color] || p.color};
  border: 1px solid
    ${p => (p.borderColor ? p.theme[p.borderColor] : p.theme[p.color] || p.color)};
  ${p =>
    p.isNumeric &&
    p.color &&
    `
        font-size: ${p.theme.fontSizeSmall};
        background-color: ${p.theme[p.color] || p.color};
        color: ${p.theme.white};
        border-color: ${p.theme.gray700};
        font-weight: 600;
      `}
`;
