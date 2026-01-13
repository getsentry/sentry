import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {unreachable} from 'sentry/utils/unreachable';

type FeatureBadgeType = 'alpha' | 'beta' | 'new' | 'experimental' | 'internal';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant:
    | 'muted'
    | 'internal'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'highlight'
    | 'promotion'
    | FeatureBadgeType;
}

export const Badge = styled('span')<BadgeProps>`
  ${p => ({...makeBadgeTheme(p, p.theme)})};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.font.size.sm};

  display: inline-flex;
  align-items: center;
  line-height: initial;
  height: 20px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.xs};
`;

function makeBadgeTheme(p: BadgeProps, theme: Theme): React.CSSProperties {
  switch (p.variant) {
    // @TODO(jonasbadalic) these should use feature badge variants
    case 'alpha':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.pink400,
      };
    case 'beta':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.yellow400,
      };
    case 'new':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.green400,
      };
    case 'experimental':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };
    case 'muted':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };
    case 'internal':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };
    // End feature badge variants
    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'highlight':
    case 'info':
      return {
        color: theme.tokens.content.accent,
        background: theme.tokens.background.transparent.accent.muted,
      };
    case 'promotion':
      return {
        color: theme.tokens.content.promotion,
        background: theme.colors.pink100,
      };
    case 'danger':
      return {
        color: theme.tokens.content.danger,
        background: theme.colors.red100,
      };
    case 'warning':
      return {
        color: theme.tokens.content.warning,
        background: theme.colors.yellow100,
      };
    case 'success':
      return {
        color: theme.tokens.content.success,
        background: theme.colors.green100,
      };
    default:
      unreachable(p.variant);
      throw new TypeError(`Unsupported badge variant: ${p.variant}`);
  }
}
