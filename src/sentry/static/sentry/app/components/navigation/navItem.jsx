/* eslint-disable react/jsx-key */
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

const NavItem = React.createClass({
  propTypes: {
    activeClassName: React.PropTypes.string.isRequired,
    to: React.PropTypes.string,
    href: React.PropTypes.string,
    query: React.PropTypes.object,
    onClick: React.PropTypes.func,
    index: React.PropTypes.bool,

    // If supplied by parent component, decides whether link element
    // is "active" or not ... overriding default behavior of strict
    // route matching
    isActive: React.PropTypes.func
  },

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getDefaultProps() {
    return {
      activeClassName: 'active',
      index: false
    };
  },

  isActive() {
    return (this.props.isActive || this.context.router.isActive)(
      {pathname: this.props.to, query: this.props.query},
      this.props.index
    );
  },

  render() {
    let {
      className,
      activeClassName,
      index,
      href,
      to,
      // eslint-disable-next-line no-unused-vars
      isActive,
      ...otherProps,
    } = this.props;

    let cx = classNames('nav-item', className, {
      [activeClassName]: !href && this.isActive(),
    });

    // Because we have views that are not handled by react
    if (href) {
      return (
        <a className={cx} href={href}>
          {this.props.children}
        </a>
      );
    }

    return (
      <Link className={cx} {...otherProps} onlyActiveOnIndex={index} to={to}>
        {this.props.children}
      </Link>
    );
  }
});

export default NavItem;
