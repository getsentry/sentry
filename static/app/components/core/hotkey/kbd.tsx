import {css, useTheme, type Theme} from '@emotion/react';

export const kbdStyles = (theme: Theme) => css`
  margin: 0;
  padding: 0 0.3em;

  font-family: ${theme.font.family.sans};
  font-size: 0.875em;
  font-weight: ${theme.font.weight.sans.medium};
  line-height: 1.6;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;

  color: ${theme.tokens.content.primary};
  background: ${theme.tokens.background.transparent.neutral.muted};
  border: 1px solid ${theme.tokens.border.primary};
  border-radius: ${theme.radius.sm};
`;

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Kbd(props: KbdProps) {
  const theme = useTheme();
  return <kbd css={kbdStyles(theme)} {...props} />;
}
