import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = React.HTMLProps<HTMLSpanElement> & {
  children?: React.ReactNode;
  text?: string | number | null;
  className?: string;
};

const Badge = styled(({text, children, ...props}: Props) => (
  <span {...props}>{text ?? children}</span>
))<Props>`
  display: inline-block;
  height: 20px;
  min-width: 20px;
  line-height: 20px;
  border-radius: 20px;
  padding: 0 5px;
  margin-left: ${space(0.5)};
  font-size: 75%;
  font-weight: 600;
  text-align: center;
  color: #fff;
  background: ${p => p.theme.badge.default.background};
  transition: background 100ms linear;

  position: relative;
  top: -1px;
`;

export default Badge;
