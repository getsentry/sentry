import {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Link, {LinkProps} from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';

type MenuItemProps = {
  /**
   * Enable to allow default event on click
   */
  allowDefaultEvent?: boolean;
  'aria-label'?: string;
  className?: string;
  /**
   * Is the item disabled?
   */
  disabled?: boolean;
  /**
   * Should this item act as a divider
   */
  divider?: boolean;
  /**
   * Provided to the onSelect callback when this item is selected
   */
  eventKey?: any;
  /**
   * Should this item act as a header
   */
  header?: boolean;
  /**
   * A server rendered URL.
   */
  href?: string;
  /**
   * Renders an icon next to the item
   */
  icon?: React.ReactNode;
  /**
   * Is the item actively selected?
   */
  isActive?: boolean;
  /**
   * Enable to provide custom button/contents via children
   */
  noAnchor?: boolean;
  /**
   * Triggered when the item is clicked
   */
  onSelect?: (eventKey: any) => void;
  /**
   * Enable to stop event propagation on click
   */
  stopPropagation?: boolean;
  /**
   * The title/tooltip of the item
   */
  title?: string;

  /**
   * A router target destination
   */
  to?: LinkProps['to'];

  /**
   * Renders a bottom border (excludes the last item)
   */
  withBorder?: boolean;
};

interface Props
  extends MenuItemProps,
    Omit<React.HTMLAttributes<HTMLLIElement>, 'onSelect'> {}

function MenuItem({
  header,
  icon,
  divider,
  isActive,
  noAnchor,
  className,
  children,
  ...props
}: Props) {
  const {
    to,
    href,
    title,
    withBorder,
    disabled,
    onSelect,
    eventKey,
    allowDefaultEvent,
    stopPropagation,
  } = props;

  const handleClick = (e: React.MouseEvent): void => {
    if (disabled) {
      return;
    }
    if (onSelect) {
      if (allowDefaultEvent !== true) {
        e.preventDefault();
      }
      if (stopPropagation) {
        e.stopPropagation();
      }
      onSelect?.(eventKey);
    }
  };

  const renderAnchor = (): React.ReactNode => {
    const linkProps = {
      onClick: handleClick,
      tabIndex: -1,
      isActive,
      disabled,
      withBorder,
    };

    if (to) {
      return (
        <MenuLink to={to} {...linkProps} title={title} data-test-id="menu-item">
          {icon && <MenuIcon>{icon}</MenuIcon>}
          {children}
        </MenuLink>
      );
    }

    if (href) {
      return (
        <MenuAnchor {...linkProps} href={href} data-test-id="menu-item">
          {icon && <MenuIcon>{icon}</MenuIcon>}
          {children}
        </MenuAnchor>
      );
    }

    return (
      <MenuTarget role="button" {...linkProps} title={title} data-test-id="menu-item">
        {icon && <MenuIcon>{icon}</MenuIcon>}
        {children}
      </MenuTarget>
    );
  };

  let renderChildren: React.ReactNode | null = null;
  if (noAnchor) {
    renderChildren = children;
  } else if (header) {
    renderChildren = children;
  } else if (!divider) {
    renderChildren = renderAnchor();
  }

  return (
    <MenuListItem
      className={className}
      role="presentation"
      isActive={isActive}
      divider={divider}
      noAnchor={noAnchor}
      header={header}
      {...omit(props, ['href', 'title', 'onSelect', 'eventKey', 'to', 'as'])}
    >
      {renderChildren}
    </MenuListItem>
  );
}

interface MenuListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  disabled?: boolean;
  divider?: boolean;
  header?: boolean;
  isActive?: boolean;
  noAnchor?: boolean;
  withBorder?: boolean;
}

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
      background: ${props.theme.active};

      &:hover {
        background: ${props.theme.activeHover};
      }
    `;
  }

  return `
    ${common}

    &:hover {
      background: ${props.theme.hover};
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

const shouldForwardProp = (p: PropertyKey) =>
  typeof p === 'string' && ['isActive', 'disabled', 'withBorder'].includes(p) === false;

const MenuAnchor = styled('a', {shouldForwardProp})<MenuListItemProps>`
  ${getListItemStyles}
`;

const MenuListItem = styled('li')<MenuListItemProps>`
  display: block;

  ${p =>
    p.withBorder &&
    `
    border-bottom: 1px solid ${p.theme.innerBorder};

    &:last-child {
      border-bottom: none;
    }
  `};
  ${p =>
    p.divider &&
    `
    height: 1px;
    margin: ${space(0.5)} 0;
    overflow: hidden;
    background-color: ${p.theme.innerBorder};
  `}
  ${p =>
    p.header &&
    `
    padding: ${space(0.25)} ${space(0.5)};
    font-size: ${p.theme.fontSizeSmall};
    line-height: 1.4;
    color: ${p.theme.gray300};
  `}

  ${getChildStyles}
`;

const MenuTarget = styled('span')<MenuListItemProps>`
  ${getListItemStyles}
  display: flex;
  align-items: center;
`;

const MenuIcon = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
`;

const MenuLink = styled(Link, {shouldForwardProp})<MenuListItemProps>`
  ${getListItemStyles}
`;

export default MenuItem;
