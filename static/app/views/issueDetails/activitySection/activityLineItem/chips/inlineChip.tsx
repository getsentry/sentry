import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

interface InlineChipProps {
  children: React.ReactNode;
  variant?: 'compactLeading' | 'constrained' | 'default';
}

export function InlineChip({children, variant = 'default'}: InlineChipProps) {
  if (variant === 'compactLeading') {
    return <CompactLeadingChipFrame>{children}</CompactLeadingChipFrame>;
  }

  if (variant === 'constrained') {
    return <ConstrainedChipFrame>{children}</ConstrainedChipFrame>;
  }

  return <ChipFrame>{children}</ChipFrame>;
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

const ChipFrame = styled('span')`
  ${chipFrameStyles};
`;

const CompactLeadingChipFrame = styled('span')`
  ${chipFrameStyles};
  padding-left: ${p => p.theme.space.xs};
`;

const ConstrainedChipFrame = styled('span')`
  ${chipFrameStyles};
  max-width: 100%;
  min-width: 0;
`;
