import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

interface InlineChipProps {
  children: React.ReactNode;
  variant?: 'compactLeading' | 'constrained' | 'default';
}

interface ChipFrameProps {
  children: React.ReactNode;
  maxWidth?: React.CSSProperties['maxWidth'];
  minWidth?: React.CSSProperties['minWidth'];
  paddingLeft?: React.CSSProperties['paddingLeft'];
}

export function InlineChip({children, variant = 'default'}: InlineChipProps) {
  const theme = useTheme();

  return (
    <ChipFrame
      maxWidth={variant === 'constrained' ? '100%' : undefined}
      minWidth={variant === 'constrained' ? 0 : undefined}
      paddingLeft={variant === 'compactLeading' ? theme.space.xs : undefined}
    >
      {children}
    </ChipFrame>
  );
}

function ChipFrame({children, maxWidth, minWidth, paddingLeft}: ChipFrameProps) {
  return (
    <ChipFrameElement style={{maxWidth, minWidth, paddingLeft}}>
      {children}
    </ChipFrameElement>
  );
}

const chipFrameStyles = (p: {theme: Theme}) => css`
  display: inline-flex;
  align-items: center;
  gap: ${p.theme.space.xs};
  min-height: 20px;
  padding: 0 ${p.theme.space.sm};
  border-radius: ${p.theme.radius.xs};
  background: ${p.theme.colors.gray100};
  color: ${p.theme.tokens.content.secondary};
  vertical-align: middle;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
  }

  a {
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    color: inherit;
  }
`;

const ChipFrameElement = styled('span')`
  ${chipFrameStyles};
`;
