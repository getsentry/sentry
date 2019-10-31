import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';
import {pickBy} from 'lodash';

import ExternalLink from 'app/components/links/externalLink';
import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';

/**
 * The button can actually also be an anchor or React router Link (which seems
 * to be poorly typed as `any`). So this is a bit of a workaround to receive
 * the proper html attributes.
 */
type ButtonElement = HTMLButtonElement & HTMLAnchorElement & any;

type Props = {
  priority?: 'default' | 'primary' | 'danger' | 'link' | 'success';
  size?: 'zero' | 'micro' | 'small' | 'xsmall' | 'xxsmall' | 'large';
  align?: 'center' | 'left' | 'right';
  disabled?: boolean;
  busy?: boolean;
  to?: string | object;
  href?: string;
  icon?: string;
  title?: string;
  external?: boolean;
  borderless?: boolean;
  label?: string;
  tooltipProps?: any;
  onClick?: (e: React.MouseEvent) => void;
};

type ButtonProps = Omit<React.HTMLProps<ButtonElement>, keyof Props | 'ref'> & Props;

type Url = ButtonProps['to'] | ButtonProps['href'];

class Button extends React.Component<ButtonProps, {}> {
  static propTypes: any = {
    priority: PropTypes.oneOf(['default', 'primary', 'danger', 'link', 'success']),
    size: PropTypes.oneOf(['zero', 'micro', 'small', 'xxsmall', 'xsmall', 'large']),
    disabled: PropTypes.bool,
    busy: PropTypes.bool,
    /**
     * Use this prop if button is a react-router link
     */
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
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
     * Text aligment, takes justify-content properties.
     */
    align: PropTypes.oneOf(['center', 'left', 'right']),
    /**
     * Label for screen-readers (`aria-label`).
     * `children` will be used by default (only if it is a string), but this property takes priority.
     */
    label: PropTypes.string,
    /**
     * Passed down to built-in tooltip component
     */
    tooltipProps: PropTypes.object,

    onClick: PropTypes.func,
  };

  static defaultProps: ButtonProps = {
    disabled: false,
    align: 'center',
  };

  // Intercept onClick and propagate
  handleClick = (e: React.MouseEvent) => {
    const {disabled, busy, onClick} = this.props;

    // Don't allow clicks when disabled or busy
    if (disabled || busy) {
      return;
    }

    if (typeof onClick !== 'function') {
      return;
    }

    onClick(e);
  };

  getUrl = <T extends Url>(prop: T): T | undefined =>
    this.props.disabled ? undefined : prop;

  render() {
    const {
      size,
      to,
      href,
      title,
      icon,
      children,
      label,
      borderless,
      align,
      priority,
      disabled,
      tooltipProps,

      // destructure from `buttonProps`
      // not necessary, but just in case someone re-orders props
      // eslint-disable-next-line no-unused-vars
      onClick,
      ...buttonProps
    } = this.props;
    // For `aria-label`
    const screenReaderLabel =
      label || (typeof children === 'string' ? children : undefined);

    // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
    // Let's use props to determine which to serve up, so we don't have to think about it.
    // *Note* you must still handle tabindex manually.
    const button = (
      <StyledButton
        aria-label={screenReaderLabel}
        aria-disabled={disabled}
        disabled={disabled}
        to={this.getUrl(to)}
        href={this.getUrl(href)}
        size={size}
        priority={priority}
        borderless={borderless}
        {...buttonProps}
        onClick={this.handleClick}
        role="button"
      >
        <ButtonLabel
          align={align}
          size={size}
          priority={priority}
          borderless={borderless}
        >
          {icon && (
            <Icon size={size} hasChildren={!!children}>
              <StyledInlineSvg
                src={icon}
                size={
                  (size && size.endsWith('small')) || size === 'micro' ? '12px' : '13px'
                }
              />
            </Icon>
          )}
          {children}
        </ButtonLabel>
      </StyledButton>
    );

    // Doing this instead of using `Tooltip`'s `disabled` prop so that we can minimize snapshot nesting
    if (title) {
      return (
        <Tooltip {...tooltipProps} title={title}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
}

export default Button;

type StyledButtonProps = ButtonProps & {theme?: any};

const getFontSize = ({size, theme}: StyledButtonProps) => {
  switch (size) {
    case 'micro':
    case 'xsmall':
    case 'xxsmall':
    case 'small':
      return theme.fontSizeSmall;
    case 'large':
      return theme.fontSizeLarge;
    default:
      return theme.fontSizeMedium;
  }
};

const getFontWeight = ({priority, borderless}: StyledButtonProps) =>
  `font-weight: ${priority === 'link' || borderless ? 400 : 600};`;

const getBoxShadow = (active: boolean) => ({
  priority,
  borderless,
  disabled,
}: StyledButtonProps) => {
  if (disabled || borderless || priority === 'link') {
    return 'box-shadow: none';
  }

  return `box-shadow: ${active ? 'inset' : ''} 0 2px rgba(0, 0, 0, 0.05)`;
};

const getColors = ({priority, disabled, borderless, theme}: StyledButtonProps) => {
  const themeName = disabled ? 'disabled' : priority || 'default';
  const {
    color,
    colorActive,
    background,
    backgroundActive,
    border,
    borderActive,
    focusShadow,
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
      color: ${colorActive || color};
      background: ${backgroundActive};
      border-color: ${!borderless && (borderActive || border)
        ? borderActive || border
        : 'transparent'};
    }

    &.focus-visible {
      ${focusShadow && `box-shadow: ${focusShadow} 0 0 0 3px;`}
    }
  `;
};

const StyledButton = styled(
  // While props is the conventional name, we're using `prop` to trick
  // eslint as using `props` results in unfixable 'missing proptypes` warnings.
  React.forwardRef<ButtonElement, ButtonProps>((prop, ref) => {
    const forwardProps = pickBy(
      prop,
      (_value, key) => key !== 'disabled' && isPropValid(key)
    );

    // Get component to use based on existence of `to` or `href` properties
    // Can be react-router `Link`, `a`, or `button`
    if (prop.to) {
      return <Link ref={ref} to={prop.to} {...forwardProps} />;
    }

    if (!prop.href) {
      return <button ref={ref} {...forwardProps} />;
    }

    if (prop.external && prop.href) {
      return <ExternalLink ref={ref} href={prop.href} {...forwardProps} />;
    }

    return <a ref={ref} {...forwardProps} />;
  })
)<Props>`
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

  ${p => (p.borderless || p.priority === 'link') && 'border-color: transparent'};
`;

/**
 * Get label padding determined by size
 */
const getLabelPadding = ({size, priority, borderless}: StyledButtonProps) => {
  if (priority === 'link') {
    return '0';
  }

  switch (size) {
    case 'micro':
    case 'zero':
      return '0';
    case 'xxsmall':
      return borderless ? '1px 2px' : '2px 4px';
    case 'xsmall':
      return borderless ? '4px 6px' : '6px 10px';
    case 'small':
      return borderless ? '6px 8px' : '8px 12px';
    case 'large':
      return borderless ? '8px 10px' : '14px 20px';

    default:
      return borderless ? '6px 10px' : '12px 16px';
  }
};

type ButtonLabelProps = Pick<ButtonProps, 'size' | 'priority' | 'borderless' | 'align'>;

const ButtonLabel = styled(
  ({size, priority, borderless, align, ...props}: ButtonLabelProps) => <span {...props} />
)<Props>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: ${p => p.align};
  padding: ${getLabelPadding};
`;

type IconProps = Omit<React.HTMLProps<HTMLSpanElement>, 'size'> & {
  size?: ButtonProps['size'];
  hasChildren?: boolean;
};

const getIconMargin = ({size, hasChildren}: IconProps) => {
  // If button is only an icon, then it shouldn't have margin
  if (!hasChildren) {
    return '0';
  }

  return size && size.endsWith('small') ? '6px' : '8px';
};

const Icon = styled(({hasChildren, ...props}: IconProps) => <span {...props} />)`
  margin-right: ${getIconMargin};
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
`;
