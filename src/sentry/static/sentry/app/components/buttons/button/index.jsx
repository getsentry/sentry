import React, {PropTypes} from 'react';
import {Link} from 'react-router';

import './styles.less';

/*

  Usage:
    <Button priority="primary" size="lg" to="/stream">Stream</Button>
    <Button size="xs" href="http://sentry.io/">Home</Button>
    <Button disabled>Not Available</Button>

*/

const Button = React.createClass({
  propTypes: {
    priority: PropTypes.oneOf(['primary', 'danger']),
    size: PropTypes.oneOf(['xs', 'sm', 'lg']),
    disabled: PropTypes.bool,
    to: PropTypes.string,
    href: PropTypes.string
  },

  render() {
    let renderedButton;
    let {
      priority,
      size,
      to,
      href,
      children,
      className,
      disabled,
      ...buttonProps
    } = this.props;

    let classNames;

    if (className) {
      classNames = className + ' button';
    } else {
      classNames = 'button';
    }

    if (priority == 'primary' || priority == 'danger') {
      classNames += ' button-' + priority;
    } else {
      classNames += ' button-default';
    }

    if (size) {
      classNames += ' button-' + size;
    }

    if (disabled) {
      classNames += ' button-disabled';
    }

    // Buttons come in 3 flavors: Link, anchor, and regular buttons. Let's
    // use props to determine which to serve up, so we don't have to think
    // about it. As a bonus, let's ensure all buttons appear as a button
    // control to screen readers. Note: you must still handle tabindex manually.

    if (to) {
      // Handle react-router Links
      renderedButton = (
        <Link to={to} {...buttonProps} className={classNames} role="button">
          {children}
        </Link>
      );
    } else if (href) {
      // Handle traditional links
      renderedButton = (
        <a href={href} {...buttonProps} className={classNames} role="button">
          {children}
        </a>
      );
    } else {
      // Otherwise, fall back to basic button element
      renderedButton = (
        <button {...buttonProps} className={classNames} role="button">{children}</button>
      );
    }

    return renderedButton;
  }
});

export default Button;
