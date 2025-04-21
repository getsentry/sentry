import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';

const SidebarDropdownMenu = (p: {theme: Theme}) => css`
  position: absolute;
  background: ${p.theme.background};
  color: ${p.theme.textColor};
  border-radius: 4px;
  border: ${p.theme.isChonk ? `1px solid ${p.theme.border}` : 'none'};
  border-bottom: ${p.theme.isChonk ? `2px solid ${p.theme.border}` : 'none'};
  box-shadow: ${p.theme.isChonk
    ? 'none'
    : '0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 20px 0 rgba(0, 0, 0, 0.3)'};
  padding: 5px 0;
  width: 250px;
  z-index: 1000;
`;

export default SidebarDropdownMenu;
