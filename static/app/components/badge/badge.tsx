import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  text?: string | number | null;
  type?: keyof Theme['badge'];
}

const Badge = styled(({children, text, ...props}: BadgeProps) => (
  <span {...props}>{children ?? text}</span>
))<BadgeProps>`
  display: inline-block;
  height: 20px;
  min-width: 20px;
  line-height: 20px;
  border-radius: 20px;
  padding: 0 5px;
  margin-left: ${space(0.5)};
  font-size: 75%;
  font-weight: ${p => p.theme.fontWeightBold};
  text-align: center;
  color: ${p => p.theme.badge[p.type ?? 'default'].color};
  background: ${p => p.theme.badge[p.type ?? 'default'].background};
  transition: background 100ms linear;

  position: relative;
`;

export default Badge;
