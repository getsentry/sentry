import {useTheme} from '@emotion/react';

export const useBadgeColors = () => {
  const theme = useTheme();

  return {
    default: {
      background: theme.gray100,
      indicatorColor: theme.gray100,
      color: theme.gray500,
    },
    alpha: {
      background: `linear-gradient(90deg, ${theme.pink300}, ${theme.yellow300})`,
      indicatorColor: theme.pink300,
      color: theme.white,
    },
    beta: {
      background: `linear-gradient(90deg, ${theme.purple300}, ${theme.pink300})`,
      indicatorColor: theme.purple300,
      color: theme.white,
    },
    new: {
      background: `linear-gradient(90deg, ${theme.blue300}, ${theme.green300})`,
      indicatorColor: theme.green300,
      color: theme.white,
    },
    experimental: {
      background: theme.gray100,
      indicatorColor: theme.gray100,
      color: theme.gray500,
    },
    internal: {
      background: theme.gray100,
      indicatorColor: theme.gray100,
      color: theme.gray500,
    },
    warning: {
      background: theme.yellow300,
      indicatorColor: theme.yellow300,
      color: theme.gray500,
    },
    gray: {
      background: `rgba(43, 34, 51, 0.08)`,
      indicatorColor: `rgba(43, 34, 51, 0.08)`,
      color: theme.gray500,
    },
  } satisfies Record<string, BadgeColors>;
};

export type BadgeType = keyof ReturnType<typeof useBadgeColors>;
export type BadgeColors = {background: string; color: string; indicatorColor: string};
