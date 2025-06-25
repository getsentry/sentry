import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import type {StrictCSSObject} from 'sentry/utils/theme';

interface InternalTextProps {
  children: React.ReactNode;
  /** @default 'left' */
  align?: 'left' | 'center' | 'right';
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** @default false */
  bold?: boolean;
  /** @default 'md' */
  fontSize?: 'sm' | 'md' | 'lg';
  /** @default 'regular' */
  lineHeight?: 'compressed' | 'regular' | 'comfortable' | 'fixed';
  /** @default false */
  underline?: boolean;
  /** @default 'primary' */
  variant?: keyof Theme['tokens']['content'];
}

const TextComponent = styled(
  ({
    children,
    align = 'left',
    bold = false,
    lineHeight = 'regular',
    fontSize = 'md',
    underline = false,
    variant = 'primary',
    ...props
  }: InternalTextProps) => <p {...props}>{children}</p>
)`
  ${getTextStyles}
`;

function getTextStyles(props: InternalTextProps & {theme: Theme}): StrictCSSObject {
  const {align, bold, lineHeight, size, underline, variant} = props;

  return {
    textAlign: align,
    fontWeight: bold ? 'bold' : 'normal',
    lineHeight:
      lineHeight === 'compressed' ? '1.2' : lineHeight === 'comfortable' ? '1.5' : '1.7',
    fontSize: props.theme.fontSize[fontSize ?? 'md'],
    textDecoration: underline ? 'underline' : 'none',
    color: props.theme.tokens.content[variant ?? 'primary'],
  };
}

interface ParagraphProps
  extends Omit<InternalTextProps, 'as'>,
    Omit<React.HTMLAttributes<HTMLParagraphElement>, 'children'> {
  as?: 'p';
}

function paragraph({children, ...props}: ParagraphProps) {
  return (
    <TextComponent as="p" {...props}>
      {children}
    </TextComponent>
  );
}

export const Text = {
  p: paragraph,
};
