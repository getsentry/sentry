import {Flex, Box} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import ExternalLink from 'app/components/externalLink';
import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';

class Button extends React.Component {
  static propTypes = {
    priority: PropTypes.oneOf(['primary', 'danger', 'link', 'success']),
    size: PropTypes.oneOf(['zero', 'small', 'xsmall', 'large']),
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
     * Path to an icon svg that will be displayed to left of button label
     */
    icon: PropTypes.string,
    /**
     * Tooltip text
     */
    title: PropTypes.string,
    /**
     * Is an external link? (Will open in new tab)
     */
    external: PropTypes.bool,
    /**
     * Button with a border
     */
    borderless: PropTypes.bool,
    /**
     * Label for screen-readers (`aria-label`).
     * `children` will be used by default (only if it is a string), but this property takes priority.
     */
    label: PropTypes.string,

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

  getUrl = prop => {
    let {disabled} = this.props;
    if (disabled) return null;
    return prop;
  };

  render() {
    let {
      size,
      to,
      href,
      title,
      icon,
      children,
      label,

      // destructure from `buttonProps`
      // not necessary, but just in case someone re-orders props
      // eslint-disable-next-line no-unused-vars
      onClick,
      ...buttonProps
    } = this.props;

    // For `aria-label`
    let screenReaderLabel = label || typeof children === 'string' ? children : undefined;

    // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
    // Let's use props to determine which to serve up, so we don't have to think about it.
    // *Note* you must still handle tabindex manually.
    let button = (
      <StyledButton
        aria-label={screenReaderLabel}
        to={this.getUrl(to)}
        href={this.getUrl(href)}
        size={size}
        {...buttonProps}
        onClick={this.handleClick}
        role="button"
      >
        <ButtonLabel size={size}>
          {icon && (
            <Icon size={size} hasChildren={!!children}>
              <StyledInlineSvg
                src={icon}
                size={size && size.endsWith('small') ? '12px' : '16px'}
              />
            </Icon>
          )}
          {children}
        </ButtonLabel>
      </StyledButton>
    );

    // Doing this instead of using `Tooltip`'s `disabled` prop so that we can minimize snapshot nesting
    if (title) {
      return <Tooltip title={title}>{button}</Tooltip>;
    }

    return button;
  }
}

export default Button;

const getFontSize = ({size, theme}) => {
  switch (size) {
    case 'xsmall':
    case 'small':
      return theme.fontSizeSmall;
    case 'large':
      return theme.fontSizeLarge;
    default:
      return theme.fontSizeMedium;
  }
};

const getFontWeight = ({priority}) => `font-weight: ${priority === 'link' ? 400 : 600};`;

const getBoxShadow = active => ({priority, borderless, disabled}) => {
  if (disabled || borderless || priority === 'link') {
    return 'box-shadow: none';
  }

  return `box-shadow: ${active ? 'inset' : ''} 0 2px rgba(0, 0, 0, 0.05)`;
};

const getColors = ({priority, disabled, borderless, theme}) => {
  let themeName = disabled ? 'disabled' : priority || 'default';
  let {
    color,
    colorActive,
    background,
    backgroundActive,
    border,
    borderActive,
  } = theme.button[themeName];

  return css`
    color: ${color};
    background-color: ${background};
    border: 1px solid ${!borderless && !!border ? border : 'transparent'};

    &:hover {
      color: ${color};
    }

    &:hover,
    &:focus,
    &:active {
      ${colorActive ? 'color: ${colorActive};' : ''};
      background: ${backgroundActive};
      border: 1px solid
        ${!borderless && (borderActive || border)
          ? borderActive || border
          : 'transparent'};
    }
  `;
};

const StyledButton = styled(({busy, external, borderless, ...props}) => {
  // Get component to use based on existance of `to` or `href` properties
  // Can be react-router `Link`, `a`, or `button`
  if (props.to) {
    return <Link {...props} />;
  }

  if (!props.href) {
    return <button {...props} />;
  }

  if (external) {
    return <ExternalLink {...props} />;
  }

  return <a {...props} />;
})`
  display: inline-block;
  line-height: 1;
  border-radius: ${p => p.theme.button.borderRadius};
  padding: 0;
  text-transform: none;

  ${getFontWeight};
  font-size: ${getFontSize};
  ${getColors};
  ${getBoxShadow(false)};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${p => (p.busy || p.disabled) && '0.65'};

  &:active {
    ${getBoxShadow(true)};
  }
  &:focus {
    outline: none;
  }

  ${p => p.borderless && 'border-color: transparent'};
`;

/**
 * Get label padding determined by size
 */
const getLabelPadding = ({size, priority}) => {
  if (priority === 'link') {
    return '0';
  }

  switch (size) {
    case 'zero':
      return '0';
    case 'xsmall':
      return '6px 10px';
    case 'small':
      return '8px 12px;';
    case 'large':
      return '14px 20px';

    default:
      return '12px 16px;';
  }
};

const ButtonLabel = styled(props => <Flex align="center" {...props} />)`
  padding: ${getLabelPadding};

  .icon {
    margin-right: 2px;
  }
`;

const getIconMargin = ({size, hasChildren}) => {
  // If button is only an icon, then it shouldn't have margin
  if (!hasChildren) {
    return '0';
  }

  return size === 'small' ? '6px' : '8px';
};

const Icon = styled(({hasChildren, ...props}) => <Box {...props} />)`
  margin-right: ${getIconMargin};
  margin-left: -2px;
  display: contents;
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
`;
