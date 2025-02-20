import styled from '@emotion/styled';

import type {BadgeColors, BadgeType} from 'sentry/components/badge/badgeColors';
import {useBadgeColors} from 'sentry/components/badge/badgeColors';
import {space} from 'sentry/styles/space';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  text?: string | number | null;
  type?: BadgeType;
}

function Badge({children, type = 'default', text, ...props}: BadgeProps) {
  const badgeColors = useBadgeColors();

  return (
    <StyledBadge badgeColors={badgeColors[type]} {...props}>
      {children ?? text}
    </StyledBadge>
  );
}

const StyledBadge = styled('span')<BadgeProps & {badgeColors: BadgeColors}>`
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
  color: ${p => p.badgeColors.color};
  background: ${p => p.badgeColors.background};
  transition: background 100ms linear;

  position: relative;
`;

export default Badge;
