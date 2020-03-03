import React from 'react';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import ExternalLink from 'app/components/links/externalLink';

import {OrgSummary} from './sidebarOrgSummary';

export type SidebarMenuItemLinkProps = {
  /**
   * Use this prop if button is a react-router link
   */
  to: string;
  /**
   * Use this prop if button should use a normal (non-react-router) link
   */
  href: string;
  /**
   * Is an external link? (Will open in new tab; Only applicable if `href` is used)
   */
  external: boolean;
  /**
   * specifies whether to open the linked document in a new tab
   */
  openInANewTab: boolean;
};

const SidebarMenuItemLink = ({
  to,
  href,
  external,
  openInANewTab,
  ...props
}: SidebarMenuItemLinkProps) => {
  const target = openInANewTab ? '_blank' : '_self';

  if (to) {
    return <Link {...props} to={to} href={href} target={target} />;
  }

  if (href) {
    return external ? (
      <ExternalLink {...props} href={href} target={target} />
    ) : (
      <Link href={href} target={target} {...props} />
    );
  }

  return <div tabIndex={0} {...props} />;
};

const StyledSidebarMenuItemLink = styled(SidebarMenuItemLink)`
  color: ${p => p.theme.gray5};
  cursor: pointer;
  display: flex;
  font-size: 14px;
  line-height: 32px;
  padding: 0 ${p => p.theme.sidebar.menuSpacing};
  position: relative;
  transition: 0.1s all linear;
  ${p => (!!p.to || !!p.href) && 'overflow: hidden'};

  &:hover,
  &:active,
  &.focus-visible {
    background: ${p => p.theme.offWhite};
    color: ${p => p.theme.gray5};
    outline: none;
  }

  ${OrgSummary} {
    padding-left: 0;
    padding-right: 0;
  }
`;

export default StyledSidebarMenuItemLink;
