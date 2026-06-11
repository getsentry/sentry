import styled from '@emotion/styled';

export const TagChip = styled('button')<{isActive: boolean}>`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 2px ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid
    ${p =>
      p.isActive ? p.theme.tokens.border.accent.vibrant : p.theme.tokens.border.primary};
  background: ${p =>
    p.isActive ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }
`;
