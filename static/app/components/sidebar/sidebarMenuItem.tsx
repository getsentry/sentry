import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import SidebarMenuItemLink from './sidebarMenuItemLink';
import SidebarOrgSummary from './sidebarOrgSummary';

type Props = {
  children: React.ReactNode;
} & React.ComponentProps<typeof SidebarMenuItemLink>;

function SidebarMenuItem({to, children, href, ...props}: Props) {
  const hasMenu = !to && !href;
  return (
    <StyledSidebarMenuItemLink to={to} href={href} {...props}>
      <MenuItemLabel hasMenu={hasMenu}>{children}</MenuItemLabel>
    </StyledSidebarMenuItemLink>
  );
}

const menuItemStyles = (
  p: Omit<React.ComponentProps<typeof SidebarMenuItemLink>, 'children'> & {theme: Theme}
) => css`
  color: ${p.theme.textColor};
  cursor: pointer;
  display: flex;
  font-size: ${p.theme.fontSizeMedium};
  line-height: 32px;
  padding: 0 ${p.theme.sidebar.menuSpacing};
  position: relative;
  transition: 0.1s all linear;
  ${(!!p.to || !!p.href) && 'overflow: hidden'};

  &:hover,
  &:active,
  &:focus-visible {
    background: ${p.theme.backgroundSecondary};
    color: ${p.theme.textColor};
    outline: none;
  }

  ${SidebarOrgSummary} {
    padding-left: 0;
    padding-right: 0;
  }
`;

const MenuItemLabel = styled('span')<{hasMenu?: boolean}>`
  flex: 1;
  ${p =>
    p.hasMenu
      ? css`
          margin: 0 -${p.theme.sidebar.menuSpacing};
          padding: 0 ${p.theme.sidebar.menuSpacing};
        `
      : css`
          overflow: hidden;
        `};
`;

const StyledSidebarMenuItemLink = styled(SidebarMenuItemLink)`
  ${menuItemStyles}
`;

export {menuItemStyles};
export default SidebarMenuItem;
