import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {Theme} from '@sentry/scraps/theme';

/**
 * Dashed, full width call to action for an empty issue sidebar section.
 */
const issueSidebarButtonStyles = (p: {theme: Theme}) => `
  width: 100%;
  min-height: 34px;
  border: 1px dashed ${p.theme.tokens.border.primary};
  border-radius: ${p.theme.radius.md};
  font-size: ${p.theme.font.size.md};
`;

export const IssueSidebarButton = styled(Button)`
  ${issueSidebarButtonStyles}
`;

export const IssueSidebarDropdownButton = styled(OverlayTrigger.Button)`
  ${issueSidebarButtonStyles}
`;
