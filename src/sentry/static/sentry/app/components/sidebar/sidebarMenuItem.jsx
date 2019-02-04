import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import Link from 'app/components/link';
import ExternalLink from 'app/components/externalLink';

import {OrgSummary} from './sidebarOrgSummary';

class SidebarMenuItem extends React.Component {
  static propTypes = {
    /**
     * Use this prop if button is a react-router link
     */
    to: PropTypes.string,
    /**
     * Use this prop if button should use a normal (non-react-router) link
     */
    href: PropTypes.string,
    /**
     * Is an external link? (Will open in new tab; Only applicable if `href` is used)
     */
    external: PropTypes.bool,
  };
  render() {
    const {children, to, href, ...props} = this.props;
    const hasMenu = !to && !href;

    return (
      <MenuItemLink to={to} href={href} {...props}>
        <MenuItemLabel hasMenu={hasMenu}>{children}</MenuItemLabel>
      </MenuItemLink>
    );
  }
}
export default SidebarMenuItem;

const MenuItemLabel = styled('span')`
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

const MenuItemLink = styled(({to, href, external, ...props}) => {
  if (to) {
    return <Link to={to} href={href} {...props} />;
  }

  if (href) {
    const Component = external ? ExternalLink : Link;
    return <Component href={href} {...props} />;
  }

  return <div {...props} />;
})`
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
  &:active {
    background: ${p => p.theme.offWhite};
    color: ${p => p.theme.gray5};
  }

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${OrgSummary} {
    padding-left: 0;
    padding-right: 0;
  }
`;
