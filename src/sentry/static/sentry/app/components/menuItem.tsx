import PropTypes from 'prop-types';
import React from 'react';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {callIfFunction} from 'app/utils/callIfFunction';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type MenuItemProps = {
  /**
   * Should this item act as a header
   */
  header?: boolean;
  /**
   * Should this item act as a divider
   */
  divider?: boolean;
  /**
   * The title/tooltipe of the item
   */
  title?: string;
  /**
   * Is the item disabled?
   */
  disabled?: boolean;
  /**
   * Triggered when the item is clicked
   */
  onSelect?: (eventKey: any) => void;
  /**
   * Provided to the onSelect callback when this item is selected
   */
  eventKey?: any;
  /**
   * Is the item actively seleted?
   */
  isActive?: boolean;
  /**
   * Enable to provide custom button/contents via children
   */
  noAnchor?: boolean;
  /**
   * A router target destination
   */
  to?: Link['props']['to'];
  /**
   * A server rendered URL.
   */
  href?: string;

  className?: string;
};

type Props = MenuItemProps & Omit<React.HTMLProps<HTMLLIElement>, keyof MenuItemProps>;

class MenuItem extends React.Component<Props> {
  static propTypes = {
    header: PropTypes.bool,
    divider: PropTypes.bool,
    title: PropTypes.string,
    disabled: PropTypes.bool,
    onSelect: PropTypes.func,
    eventKey: PropTypes.any,
    isActive: PropTypes.bool,
    noAnchor: PropTypes.bool,
    to: PropTypes.string,
    href: PropTypes.string,
    query: PropTypes.object,
    className: PropTypes.string,
  };

  handleClick = (e: React.MouseEvent): void => {
    const {onSelect, disabled, eventKey} = this.props;
    if (disabled) {
      return;
    }
    if (onSelect) {
      e.preventDefault();
      callIfFunction(onSelect, eventKey);
    }
  };

  renderAnchor = (): React.ReactNode => {
    const {to, href, title, disabled, isActive, children} = this.props;
    if (to) {
      return (
        <MenuLink
          to={to}
          title={title}
          onClick={this.handleClick}
          tabIndex={-1}
          isActive={isActive}
          disabled={disabled}
        >
          {children}
        </MenuLink>
      );
    }

    if (href) {
      return (
        <MenuAnchor
          href={href}
          onClick={this.handleClick}
          tabIndex={-1}
          isActive={isActive}
          disabled={disabled}
        >
          {children}
        </MenuAnchor>
      );
    }

    return (
      <MenuTarget
        role="button"
        title={title}
        onClick={this.handleClick}
        tabIndex={-1}
        isActive={isActive}
        disabled={disabled}
      >
        {this.props.children}
      </MenuTarget>
    );
  };

  render() {
    const {
      header,
      divider,
      isActive,
      noAnchor,
      className,
      children,
      ...props
    } = this.props;

    let renderChildren: React.ReactNode | null = null;
    if (noAnchor) {
      renderChildren = children;
    } else if (header) {
      renderChildren = children;
    } else if (!divider) {
      renderChildren = this.renderAnchor();
    }

    return (
      <MenuListItem
        className={className}
        role="presentation"
        isActive={isActive}
        divider={divider}
        noAnchor={noAnchor}
        header={header}
        {...omit(props, ['href', 'title', 'onSelect', 'eventKey', 'to'])}
      >
        {renderChildren}
      </MenuListItem>
    );
  }
}

type MenuListItemProps = {
  header?: boolean;
  noAnchor?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  divider?: boolean;
} & React.HTMLProps<HTMLLIElement>;

function getListItemStyles(props: MenuListItemProps & {theme: Theme}) {
  const common = `
    display: block;
    padding: ${space(0.5)} ${space(2)};
    &:focus {
      outline: none;
    }
  `;

  if (props.disabled) {
    return `
      ${common}
      color: ${props.theme.disabled};
      background: transparent;
      cursor: not-allowed;
    `;
  }

  if (props.isActive) {
    return `
      ${common}
      color: ${props.theme.white};
      background: ${props.theme.purple400};
    `;
  }

  return `
    ${common}
    color: ${props.theme.gray700};

    &:hover {
      background: ${props.theme.gray100};
    }
  `;
}

function getChildStyles(props: MenuListItemProps & {theme: Theme}) {
  if (!props.noAnchor) {
    return '';
  }

  return `
    & a {
      ${getListItemStyles(props)}
    }
  `;
}

const MenuAnchor = styled('a', {
  shouldForwardProp: p => ['isActive', 'disabled'].includes(p) === false,
})<MenuListItemProps>`
  ${getListItemStyles}
`;

const MenuListItem = styled('li')<MenuListItemProps>`
  display: block;

  ${p =>
    p.divider &&
    `
height: 1px;
margin: ${space(0.5)} 0;
overflow: hidden;
background-color: ${p.theme.gray300};
    `}
  ${p =>
    p.header &&
    `
    padding: ${space(0.25)} ${space(1)};
    font-size: ${p.theme.fontSizeSmall};
    line-height: 1.4;
    color: ${p.theme.gray500};
  `}

  ${getChildStyles}
`;

const MenuTarget = styled('span')<MenuListItemProps>`
  ${getListItemStyles}
`;

const MenuLink = styled(Link, {
  shouldForwardProp: p => ['isActive', 'disabled'].includes(p) === false,
})<MenuListItemProps>`
  ${getListItemStyles}
`;

export default MenuItem;
