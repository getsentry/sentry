import styled from '@emotion/styled';

/**
 * Provides default styling for custom footer content in a `DropdownMenu`.
 */
export const DropdownMenuFooter = styled('div')`
  border-top: solid 1px ${p => p.theme.innerBorder};
  padding: ${p => p.theme.space(1)} ${p => p.theme.space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
`;
