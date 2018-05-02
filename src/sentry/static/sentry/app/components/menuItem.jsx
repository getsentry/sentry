import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

class MenuItem extends React.Component {
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
    linkClassName: PropTypes.string,
    onClick: PropTypes.func,
  };

  handleClick = e => {
    if (this.props.onSelect) {
      e.preventDefault();
      this.props.onSelect(this.props.eventKey);
    }
  };

  renderAnchor = () => {
    if (this.props.to) {
      return (
        <Link
          to={{pathname: this.props.to, query: this.props.query}}
          title={this.props.title}
          onClick={this.handleClick}
          className={this.props.linkClassName}
          tabIndex="-1"
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
        className={this.props.linkClassName}
        tabIndex="-1"
      >
        {this.props.children}
      </a>
    );
  };

  render() {
    let classes = {
      'dropdown-header': this.props.header,
      divider: this.props.divider,
      active: this.props.isActive,
    };

    let children = null;
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
        title={null}
        href={null}
        className={classNames(this.props.className, classes)}
        onClick={this.props.onClick}
      >
        {children}
      </li>
    );
  }
}

export default MenuItem;
