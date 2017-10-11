import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import FlowLayout from '../flowLayout';

import '../../../less/components/button.less';

const Button = React.createClass({
  propTypes: {
    priority: PropTypes.oneOf(['primary', 'danger', 'link']),
    size: PropTypes.oneOf(['small', 'xsmall', 'large']),
    disabled: PropTypes.bool,
    busy: PropTypes.bool,
    /**
     * Use this prop if button is a react-router link
     */
    to: PropTypes.string,
    /**
     * Use this prop if button should use a normal (non-react-router) link
     */
    href: PropTypes.string,
    /**
     * Tooltip text
     */
    title: PropTypes.string,
    borderless: PropTypes.bool,
    onClick: PropTypes.func,
  },

  getDefaultProps() {
    return {
      disabled: false,
    };
  },

  // Intercept onClick and propagate
  handleClick(...args) {
    let {disabled, busy, onClick} = this.props;

    // Don't allow clicks when disabled or busy
    if (disabled || busy) return;

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
      busy,
      title,
      borderless,

      // destructure from `buttonProps`
      // not necessary, but just in case someone re-orders props
      // eslint-disable-next-line no-unused-vars
      onClick,
      ...buttonProps
    } = this.props;

    let isPrimary = priority === 'primary' && !disabled;
    let isDanger = priority === 'danger' && !disabled;
    let isLink = priority === 'link';

    let cx = classNames(className, 'button', {
      tip: !!title,
      'button-no-border': borderless,
      'button-primary': isPrimary,
      'button-danger': isDanger,
      'button-link': isLink && !isPrimary && !isDanger,
      'button-default': !isLink && !isPrimary && !isDanger,
      'button-sm': size === 'small',
      'button-xs': size === 'xsmall',
      'button-lg': size === 'large',
      'button-busy': busy,
      'button-disabled': disabled,
    });

    // This container is useless now, but leaves room for when we need to add
    // components (i.e. icons, busy indicator, etc)
    let childContainer = (
      <FlowLayout truncate={false}>
        <span className="button-label">{children}</span>
      </FlowLayout>
    );

    // Buttons come in 3 flavors: Link, anchor, and regular buttons. Let's
    // use props to determine which to serve up, so we don't have to think
    // about it. As a bonus, let's ensure all buttons appear as a button
    // control to screen readers. Note: you must still handle tabindex manually.

    // Props common to all elements
    let componentProps = {
      disabled,
      ...buttonProps,
      onClick: this.handleClick,
      className: cx,
      role: 'button',
      children: childContainer,
    };

    // Handle react-router Links
    if (to) {
      return <Link to={to} {...componentProps} />;
    }

    // Handle traditional links
    if (href) {
      return <a href={href} {...componentProps} />;
    }

    // Otherwise, fall back to basic button element
    return <button {...componentProps} />;
  },
});

export default Button;
