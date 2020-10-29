import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

const SidebarDropdownMenu = (p: {theme: Theme}) => css`
  position: absolute;
  background: ${p.theme.white};
  color: ${p.theme.gray800};
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 20px 0 rgba(0, 0, 0, 0.3);
  padding: 5px 0;
  width: 250px;
  z-index: 1000;
`;

export default SidebarDropdownMenu;
