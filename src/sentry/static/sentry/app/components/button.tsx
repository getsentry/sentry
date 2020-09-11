import {Link} from 'react-router';
import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {Theme} from 'app/utils/theme';
import ExternalLink from 'app/components/links/externalLink';
import Tooltip from 'app/components/tooltip';

/**
 * The button can actually also be an anchor or React router Link (which seems
 * to be poorly typed as `any`). So this is a bit of a workaround to receive
 * the proper html attributes.
 */
type ButtonElement = HTMLButtonElement & HTMLAnchorElement & any;

type Props = {
  priority?: 'default' | 'primary' | 'danger' | 'link' | 'success';
  size?: 'zero' | 'xsmall' | 'small';
  align?: 'center' | 'left' | 'right';
  disabled?: boolean;
  busy?: boolean;
  to?: string | object;
  href?: string;
  icon?: React.ReactNode;
  title?: string;
  external?: boolean;
  borderless?: boolean;
  label?: string;
  tooltipProps?: any;
  onClick?: (e: React.MouseEvent) => void;
  forwardRef?: React.Ref<ButtonElement>;
  name?: string;

  // This is only used with `<ButtonBar>`
  barId?: string;
};

type ButtonProps = Omit<React.HTMLProps<ButtonElement>, keyof Props> & Props;

type Url = ButtonProps['to'] | ButtonProps['href'];

class Button extends React.Component<ButtonProps, {}> {
  static propTypes: any = {
    priority: PropTypes.oneOf(['default', 'primary', 'danger', 'link', 'success']),
    size: PropTypes.oneOf(['zero', 'xsmall', 'small']),
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
     * A react node to use as the icons. Generally pulled from app/icons
     */
    icon: PropTypes.node,
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

    forwardRef: PropTypes.any,
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
      e.preventDefault();
      e.stopPropagation();
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
      onClick: _onClick,
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
              {icon}
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

const ButtonForwardRef = React.forwardRef<ButtonElement, ButtonProps>((props, ref) => (
  <Button forwardRef={ref} {...props} />
));

// Some components use Button's propTypes
ButtonForwardRef.propTypes = Button.propTypes;
ButtonForwardRef.displayName = 'forwardRef<Button>';

export default ButtonForwardRef;

type StyledButtonProps = ButtonProps & {theme: Theme};

const getFontSize = ({size, theme}: StyledButtonProps) => {
  switch (size) {
    case 'xsmall':
    case 'small':
      return theme.fontSizeSmall;
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
  ({forwardRef, external, ...props}) => {
    // Get component to use based on existence of `to` or `href` properties
    // Can be react-router `Link`, `a`, or `button`
    if (props.to) {
      return <Link ref={forwardRef} {...props} />;
    }

    if (!props.href) {
      return <button ref={forwardRef} {...props} />;
    }

    if (external && props.href) {
      return <ExternalLink ref={forwardRef} {...props} />;
    }

    return <a ref={forwardRef} {...props} />;
  },
  {
    shouldForwardProp: prop =>
      prop === 'forwardRef' ||
      prop === 'external' ||
      (isPropValid(prop) && prop !== 'disabled'),
  }
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
const getLabelPadding = ({
  size,
  priority,
}: Pick<StyledButtonProps, 'size' | 'priority' | 'borderless'>) => {
  if (priority === 'link') {
    return '0';
  }

  switch (size) {
    case 'zero':
      return '0';
    case 'xsmall':
      return '5px 8px';
    case 'small':
      return '9px 12px';
    default:
      return '12px 16px';
  }
};

const buttonLabelPropKeys = ['size', 'priority', 'borderless', 'align'];
type ButtonLabelProps = Pick<ButtonProps, 'size' | 'priority' | 'borderless' | 'align'>;

const ButtonLabel = styled('span', {
  shouldForwardProp: prop => isPropValid(prop) && !buttonLabelPropKeys.includes(prop),
})<ButtonLabelProps>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: ${p => p.align};
  padding: ${getLabelPadding};
`;

type IconProps = {
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

const Icon = styled('span')<IconProps & Omit<StyledButtonProps, 'theme'>>`
  display: flex;
  align-items: center;
  margin-right: ${getIconMargin};
  height: ${getFontSize};
`;
