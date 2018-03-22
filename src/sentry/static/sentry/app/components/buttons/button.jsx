import {Flex, Box} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import classNames from 'classnames';

import InlineSvg from '../inlineSvg';
import '../../../less/components/button.less';

const Icon = styled(Box)`
  margin-right: ${p => (p.size === 'small' ? '6px' : '8px')};
  margin-left: -2px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
`;

class Button extends React.Component {
  static propTypes = {
    priority: PropTypes.oneOf(['primary', 'danger', 'link', 'success']),
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
    icon: PropTypes.string,
    /**
     * Tooltip text
     */
    title: PropTypes.string,
    borderless: PropTypes.bool,
    onClick: PropTypes.func,
  };

  static defaultProps = {
    disabled: false,
  };

  // Intercept onClick and propagate
  handleClick = (...args) => {
    let {disabled, busy, onClick} = this.props;

    // Don't allow clicks when disabled or busy
    if (disabled || busy) return;

    if (typeof onClick !== 'function') return;

    onClick(...args);
  };

  getUrl = () => {
    let {disabled, to, href} = this.props;
    if (disabled) return null;
    return to || href;
  };

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
      icon,

      // destructure from `buttonProps`
      // not necessary, but just in case someone re-orders props
      // eslint-disable-next-line no-unused-vars
      onClick,
      ...buttonProps
    } = this.props;

    let isPrimary = priority === 'primary' && !disabled;
    let isDanger = priority === 'danger' && !disabled;
    let isSuccess = priority === 'success' && !disabled;
    let isLink = priority === 'link';

    let cx = classNames(className, 'button', {
      tip: !!title,
      'button-no-border': borderless,
      'button-primary': isPrimary,
      'button-danger': isDanger,
      'button-success': isSuccess,
      'button-link': isLink && !isPrimary && !isDanger,
      'button-default': !isLink && !isPrimary && !isDanger,
      'button-sm': size === 'small',
      'button-xs': size === 'xsmall',
      'button-lg': size === 'large',
      'button-busy': busy,
      'button-disabled': disabled,
    });

    let childContainer = (
      <Flex align="center" className="button-label">
        {icon && (
          <Icon size={size}>
            <StyledInlineSvg src={icon} size={size === 'small' ? '12px' : '16px'} />
          </Icon>
        )}
        {children}
      </Flex>
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
      return <Link to={this.getUrl()} {...componentProps} />;
    }

    // Handle traditional links
    if (href) {
      return <a href={this.getUrl()} {...componentProps} />;
    }

    // Otherwise, fall back to basic button element
    return <button {...componentProps} />;
  }
}

export default Button;
