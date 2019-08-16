import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

type Props = {
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
  };

  render() {
    const classes = {
      'dropdown-header': this.props.header,
      divider: this.props.divider,
      active: this.props.isActive,
    };

    let children: React.ReactNode | null = null;
    if (this.props.noAnchor) {
      children = this.props.children;
    } else if (this.props.header) {
      children = this.props.children;
    } else if (!this.props.divider) {
      children = this.renderAnchor();
    }

    return (
      <li
        role="presentation"
        className={classNames(this.props.className, classes)}
        onClick={this.props.onClick}
      >
        {children}
      </li>
    );
  }
}

export default MenuItem;
