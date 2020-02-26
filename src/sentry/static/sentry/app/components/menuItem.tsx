import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

type MenuItemProps = {
  header?: boolean;
  divider?: boolean;
  title?: string;
  onSelect?: (eventKey: any) => void;
  eventKey?: any;
  isActive?: boolean;
  noAnchor?: boolean;
  href?: string;
  to?: string;
  query?: object;
  className?: string;
  onClick?: (evt: React.MouseEvent) => void;
};

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
          to={{pathname: this.props.to, query: this.props.query}}
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
      title,
      onSelect,
      eventKey,
      isActive,
      noAnchor,
      href,
      to,
      query,
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
        {...props}
      >
        {renderChildren}
      </li>
    );
  }
}

export default MenuItem;
