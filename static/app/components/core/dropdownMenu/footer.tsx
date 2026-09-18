import styled from '@emotion/styled';

/**
 * Provides default styling for custom footer content in a `DropdownMenu`.
 */
export const DropdownMenuFooter = styled('div')`
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  display: flex;
  align-items: center;
`;
