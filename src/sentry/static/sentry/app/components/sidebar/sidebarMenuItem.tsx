import * as React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

import SidebarMenuItemLink from './sidebarMenuItemLink';
import {OrgSummary} from './sidebarOrgSummary';

type Props = {
  children: React.ReactNode;
} & React.ComponentProps<typeof SidebarMenuItemLink>;

const SidebarMenuItem = ({to, children, href, ...props}: Props) => {
  const hasMenu = !to && !href;
  return (
    <StyledSidebarMenuItemLink to={to} href={href} {...props}>
      <MenuItemLabel hasMenu={hasMenu}>{children}</MenuItemLabel>
    </StyledSidebarMenuItemLink>
  );
};

const menuItemStyles = (
  p: React.ComponentProps<typeof SidebarMenuItemLink> & {theme: Theme}
) => css`
  color: ${p.theme.gray800};
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
  &.focus-visible {
    background: ${p.theme.gray100};
    color: ${p.theme.gray800};
    outline: none;
  }

  ${OrgSummary} {
    padding-left: 0;
    padding-right: 0;
  }
`;

const MenuItemLabel = styled('span')<{hasMenu?: boolean}>`
  flex: 1;
  ${p =>
    p.hasMenu
      ? css`
          margin: 0 -15px;
          padding: 0 15px;
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
