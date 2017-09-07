import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

import '../../../less/components/button.less';

const Button = React.createClass({
  propTypes: {
    priority: PropTypes.oneOf(['primary', 'danger']),
    size: PropTypes.oneOf(['small', 'xsmall', 'large']),
    disabled: PropTypes.bool,
    /**
     * Use this prop if button is a react-router link
     */
    to: PropTypes.string,
    /**
     * Use this prop if button should use a normal (non-react-router) link
     */
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
      priority,
      size,
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

    let isPrimary = priority === 'primary';
    let isDanger = priority === 'danger';
    let cx = classNames(className, 'button', {
      'button-primary': isPrimary,
      'button-danger': isDanger,
      'button-default': !isPrimary && !isDanger,
      'button-sm': size === 'small',
      'button-xs': size === 'xsmall',
      'button-lg': size === 'large',
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
          disabled={disabled}
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
          disabled={disabled}
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
      <button
        disabled={disabled}
        {...buttonProps}
        onClick={this.handleClick}
        className={cx}
        role="button">
        {children}
      </button>
    );
  }
});

export default Button;
