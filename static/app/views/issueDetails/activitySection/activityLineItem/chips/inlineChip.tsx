import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

interface InlineChipProps {
  children: React.ReactNode;
  /**
   * Applies a hover affordance (pointer cursor and background step) for chips
   * that are wrapped in a link or are otherwise clickable.
   */
  interactive?: boolean;
  tone?: 'accent' | 'default';
  variant?: 'compactLeading' | 'constrained' | 'constrainedCompactLeading' | 'default';
}

interface ChipFrameProps {
  children: React.ReactNode;
  constrained?: boolean;
  interactive?: boolean;
  maxWidth?: React.CSSProperties['maxWidth'];
  minWidth?: React.CSSProperties['minWidth'];
  paddingLeft?: React.CSSProperties['paddingLeft'];
  tone?: InlineChipProps['tone'];
}

export function InlineChip({
  children,
  interactive = false,
  tone = 'default',
  variant = 'default',
}: InlineChipProps) {
  const theme = useTheme();
  const constrained =
    variant === 'constrained' || variant === 'constrainedCompactLeading';
  const compactLeading =
    variant === 'compactLeading' || variant === 'constrainedCompactLeading';

  return (
    <ChipFrame
      constrained={constrained}
      interactive={interactive}
      maxWidth={constrained ? '100%' : undefined}
      minWidth={constrained ? 0 : undefined}
      paddingLeft={compactLeading ? theme.space.xs : undefined}
      tone={tone}
    >
      {children}
    </ChipFrame>
  );
}

function ChipFrame({
  children,
  constrained,
  interactive,
  maxWidth,
  minWidth,
  paddingLeft,
  tone,
}: ChipFrameProps) {
  return (
    <ChipFrameElement
      data-constrained={constrained ? true : undefined}
      data-interactive={interactive ? true : undefined}
      data-tone={tone}
      style={{maxWidth, minWidth, paddingLeft}}
    >
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
  font-weight: ${p.theme.font.weight.sans.regular};
  vertical-align: middle;
  white-space: nowrap;

  &[data-constrained='true'] {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &[data-interactive='true'] {
    cursor: pointer;
    transition: background 80ms ease-out;
  }

  &[data-interactive='true']:hover {
    background: ${p.theme.colors.gray200};
  }

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

  &[data-tone='accent'] {
    background: ${p.theme.tokens.background.transparent.accent.muted};
    color: ${p.theme.tokens.content.accent};
  }

  &[data-interactive='true'][data-tone='accent']:hover {
    background: ${p.theme.colors.blue200};
  }
`;

const ChipFrameElement = styled('span')`
  ${chipFrameStyles};
`;
