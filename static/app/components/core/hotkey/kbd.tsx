import {css, useTheme, type Theme} from '@emotion/react';

export const kbdStyles = (theme: Theme, variant?: KbdProps['variant']) => css`
  margin: 0;
  padding: 0 ${theme.space['2xs']};

  font-family: ${theme.font.family.mono};
  font-size: ${theme.font.size.sm};
  font-weight: ${theme.font.weight.sans.medium};

  display: inline-flex;
  align-items: center;
  justify-content: center;

  color: ${variant === 'debossed'
    ? theme.tokens.content.secondary
    : theme.tokens.content.primary};
  background: ${variant === 'debossed'
    ? theme.tokens.background.secondary
    : theme.tokens.background.primary};
  border: ${theme.border.md} solid ${theme.tokens.border.primary};
  border-top: ${variant === 'debossed'
    ? `${theme.border.xl} solid ${theme.tokens.border.primary}`
    : undefined};
  border-bottom: ${variant === 'debossed'
    ? undefined
    : `${theme.border.xl} solid ${theme.tokens.border.primary}`};
  border-radius: ${theme.radius.sm};
  box-shadow: none;
`;

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  variant?: 'embossed' | 'debossed';
}

export function Kbd(props: KbdProps) {
  const theme = useTheme();
  return <kbd css={kbdStyles(theme, props.variant)} {...props} />;
}
