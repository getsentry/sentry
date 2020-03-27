import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import omit from 'lodash/omit';

import Link from 'app/components/links/link';

type MenuItemProps = {
  header?: boolean;
  divider?: boolean;
  title?: string;
  onSelect?: (eventKey: any) => void;
  eventKey?: any;
  isActive?: boolean;
  noAnchor?: boolean;
  href?: string;
  className?: string;
  onClick?: (evt: React.MouseEvent) => void;
} & Partial<Pick<Link['props'], 'to'>>;

type Props = MenuItemProps & Omit<React.HTMLProps<HTMLLIElement>, keyof MenuItemProps>;

class MenuItem extends React.Component<Props> {
  static propTypes = {
    header: PropTypes.bool,
    divider: PropTypes.bool,
    title: PropTypes.string,
    onSelect: PropTypes.func,
    eventKey: PropTypes.any,
    isActive: PropTypes.bool,
    noAnchor: PropTypes.bool,
    // basic link
    href: PropTypes.string,
    // router link
    to: PropTypes.string,
    query: PropTypes.object,
    className: PropTypes.string,
    onClick: PropTypes.func,
  };

  handleClick = (e: React.MouseEvent): void => {
    if (this.props.onSelect) {
      e.preventDefault();
      this.props.onSelect(this.props.eventKey);
    }
  };

  renderAnchor = (): React.ReactNode => {
    if (this.props.to) {
      return (
        <Link
          to={this.props.to}
          title={this.props.title}
          onClick={this.handleClick}
          tabIndex={-1}
        >
          {this.props.children}
        </Link>
      );
    }
    if (this.props.href) {
      return (
        <a
          title={this.props.title}
          onClick={this.handleClick}
          href={this.props.href}
          tabIndex={-1}
        >
          {this.props.children}
        </a>
      );
    }

    return (
      <span
        className="menu-target"
        role="button"
        title={this.props.title}
        onClick={this.handleClick}
        tabIndex={-1}
      >
        {this.props.children}
      </span>
    );
  };

  render() {
    const {
      header,
      divider,
      isActive,
      noAnchor,
      className,
      onClick,
      children,
      ...props
    } = this.props;

    const classes = {
      'dropdown-header': header,
      active: isActive,
      divider,
    };

    let renderChildren: React.ReactNode | null = null;
    if (noAnchor) {
      renderChildren = children;
    } else if (header) {
      renderChildren = children;
    } else if (!divider) {
      renderChildren = this.renderAnchor();
    }

    return (
      <li
        role="presentation"
        className={classNames(className, classes)}
        onClick={onClick}
        {...omit(props, ['title', 'onSelect', 'eventKey', 'to'])}
      >
        {renderChildren}
      </li>
    );
  }
}

export default MenuItem;
