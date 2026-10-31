import type * as React from 'react';
import {css} from '@emotion/react';
import {styled} from '@yak/react';

import type {Theme} from '@sentry/scraps/theme';
import {withYakProps, withYakTheme} from '@sentry/scraps/yak';

export const kbdStyles = (theme: Theme, variant?: KbdProps['variant']) => css`
  margin: 0;
  padding: 0 ${theme.space.xs};
  height: 1.67em; /* 20px */

  font-family: ${theme.font.family.mono};
  font-size: ${theme.font.size.sm};
  font-weight: ${theme.font.weight.sans.medium};

  display: inline-flex;
  align-items: center;
  justify-content: center;

  color: ${
    variant === 'debossed' ? theme.tokens.content.secondary : theme.tokens.content.primary
  };
  background: ${
    variant === 'debossed'
      ? theme.tokens.background.secondary
      : theme.tokens.background.primary
  };
  border: ${theme.border.md} solid ${theme.tokens.border.primary};
  border-top: ${
    variant === 'debossed'
      ? `${theme.border.xl} solid ${theme.tokens.border.primary}`
      : undefined
  };
  border-bottom: ${
    variant === 'debossed'
      ? undefined
      : `${theme.border.xl} solid ${theme.tokens.border.primary}`
  };
  border-radius: ${theme.radius.sm};
  box-shadow: none;
`;

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  variant?: 'embossed' | 'debossed';
}

const StyledKbd = withYakTheme(styled(withYakProps('kbd'))<KbdProps>`
  margin: 0;
  padding: 0 ${p => p.theme.space.xs ?? ''};
  height: 1.67em; /* 20px */

  font-family: ${p => p.theme.font.family.mono ?? ''};
  font-size: ${p => p.theme.font.size.sm ?? ''};
  font-weight: ${p => p.theme.font.weight.sans.medium ?? ''};

  display: inline-flex;
  align-items: center;
  justify-content: center;

  color: ${p => (p.variant === 'debossed' ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary) ?? ''};
  background: ${p =>
    (p.variant === 'debossed'
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary) ?? ''};
  border: ${p => p.theme.border.md ?? ''} solid
    ${p => p.theme.tokens.border.primary ?? ''};
  border-top: ${p =>
    (p.variant === 'debossed'
      ? `${p.theme.border.xl} solid ${p.theme.tokens.border.primary}`
      : undefined) ?? ''};
  border-bottom: ${p =>
    (p.variant === 'debossed'
      ? undefined
      : `${p.theme.border.xl} solid ${p.theme.tokens.border.primary}`) ?? ''};
  border-radius: ${p => p.theme.radius.sm ?? ''};
  box-shadow: none;
`);
export function Kbd(props: KbdProps) {
  return <StyledKbd {...props} />;
}
