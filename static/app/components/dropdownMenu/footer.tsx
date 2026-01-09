import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

/**
 * Provides default styling for custom footer content in a `DropdownMenu`.
 */
export const DropdownMenuFooter = styled('div')`
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  padding: ${space(1)} ${space(1.5)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  display: flex;
  align-items: center;
`;
