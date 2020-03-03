import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import SidebarMenuItemLink, {SidebarMenuItemLinkProps} from './sidebarMenuItemLink';

type Props = {
  children: React.ReactNode;
} & SidebarMenuItemLinkProps;

const SidebarMenuItem = ({to, href, children, ...props}: Props) => {
  const hasMenu = !to && !href;
  return (
    <SidebarMenuItemLink to={to} href={href} {...props}>
      <MenuItemLabel hasMenu={hasMenu}>{children}</MenuItemLabel>
    </SidebarMenuItemLink>
  );
};

export default SidebarMenuItem;

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
