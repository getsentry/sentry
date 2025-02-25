import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const useBadgeColors = () => {
  const theme = useTheme();

  return {
    default: {
      background: theme.gray100,
      color: theme.gray500,
    },
    alpha: {
      background: `linear-gradient(90deg, ${theme.pink300}, ${theme.yellow300})`,
      color: theme.white,
    },
    beta: {
      background: `linear-gradient(90deg, ${theme.purple300}, ${theme.pink300})`,
      color: theme.white,
    },
    new: {
      background: `linear-gradient(90deg, ${theme.blue300}, ${theme.green300})`,
      color: theme.white,
    },
    experimental: {
      background: theme.gray100,
      color: theme.gray500,
    },
    internal: {
      background: theme.gray100,
      color: theme.gray500,
    },
    warning: {
      background: theme.yellow300,
      color: theme.gray500,
    },
    gray: {
      background: `rgba(43, 34, 51, 0.08)`,
      color: theme.gray500,
    },
  } satisfies Record<string, BadgeColors>;
};

export type BadgeType = keyof ReturnType<typeof useBadgeColors>;
type BadgeColors = {background: string; color: string};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  text?: string | number | null;
  type?: BadgeType;
}

export default function Badge({children, type = 'default', text, ...props}: BadgeProps) {
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
