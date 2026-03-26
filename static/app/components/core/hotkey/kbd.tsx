import {css, useTheme, type Theme} from '@emotion/react';

export const kbdStyles = (theme: Theme) => css`
  margin: 0;
  padding: 0 ${theme.space['2xs']};

  font-family: ${theme.font.family.sans};
  font-size: ${theme.font.size.sm};
  font-weight: ${theme.font.weight.sans.medium};
  line-height: 1.5;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;

  color: ${theme.tokens.content.primary};
  background: ${theme.tokens.background.primary};
  border: ${theme.border.md} solid ${theme.tokens.border.primary};
  border-bottom: ${theme.border.xl} solid ${theme.tokens.border.primary};
  border-radius: ${theme.radius.sm};
  box-shadow: none;
`;

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Kbd(props: KbdProps) {
  const theme = useTheme();
  return <kbd css={kbdStyles(theme)} {...props} />;
}
