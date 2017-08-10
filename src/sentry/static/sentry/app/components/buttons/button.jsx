import React, {PropTypes} from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

import '../../../less/components/button.less';

const Button = React.createClass({
  propTypes: {
    primary: PropTypes.bool,
    danger: PropTypes.bool,
    disabled: PropTypes.bool,
    small: PropTypes.bool,
    xsmall: PropTypes.bool,
    large: PropTypes.bool,
    to: PropTypes.string,
    href: PropTypes.string,
    onClick: PropTypes.func
  },

  getDefaultProps() {
    return {
      disabled: false
    };
  },

  // Intercept onClick and propagate
  handleClick(...args) {
    let {disabled, onClick} = this.props;
    if (disabled) return;
    if (typeof onClick !== 'function') return;

    onClick(...args);
  },

  render() {
    let {
      primary,
      danger,
      small,
      xsmall,
      large,
      to,
      href,
      children,
      className,
      disabled,

      // destructure from `buttonProps`
      // not necessary, but just in case someone re-orders props
      // eslint-disable-next-line no-unused-vars
      onClick,
      ...buttonProps
    } = this.props;

    let cx = classNames(className, 'button', {
      'button-primary': primary,
      'button-danger': danger,
      'button-default': !primary && !danger,
      'button-sm': small,
      'button-xs': xsmall,
      'button-lg': large,
      'button-disabled': disabled
    });

    // Buttons come in 3 flavors: Link, anchor, and regular buttons. Let's
    // use props to determine which to serve up, so we don't have to think
    // about it. As a bonus, let's ensure all buttons appear as a button
    // control to screen readers. Note: you must still handle tabindex manually.

    // Handle react-router Links
    if (to) {
      return (
        <Link
          to={to}
          {...buttonProps}
          onClick={this.handleClick}
          className={cx}
          role="button">
          {children}
        </Link>
      );
    }

    // Handle traditional links
    if (href) {
      return (
        <a
          href={href}
          {...buttonProps}
          onClick={this.handleClick}
          className={cx}
          role="button">
          {children}
        </a>
      );
    }

    // Otherwise, fall back to basic button element
    return (
      <button {...buttonProps} onClick={this.handleClick} className={cx} role="button">
        {children}
      </button>
    );
  }
});

export default Button;
