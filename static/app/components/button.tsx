import {forwardRef as reactForwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import {Theme} from 'sentry/utils/theme';

/**
 * The button can actually also be an anchor or React router Link (which seems
 * to be poorly typed as `any`). So this is a bit of a workaround to receive
 * the proper html attributes.
 */
type ButtonElement = HTMLButtonElement & HTMLAnchorElement & any;

type ConditionalAriaLabel =
  | {
      children: Omit<React.ReactNode, 'null' | 'undefined' | 'boolean'>;
      'aria-label'?: string;
    }
  | {
      children?: null | boolean;
      'aria-label': string;
    };

type Props = {
  priority?: 'default' | 'primary' | 'danger' | 'link' | 'success' | 'form';
  size?: 'zero' | 'xsmall' | 'small';
  align?: 'center' | 'left' | 'right';
  disabled?: boolean;
  busy?: boolean;
  to?: string | object;
  href?: string;
  icon?: React.ReactNode;
  title?: React.ComponentProps<typeof Tooltip>['title'];
  external?: boolean;
  borderless?: boolean;
  tooltipProps?: Omit<Tooltip['props'], 'children' | 'title' | 'skipWrapper'>;
  onClick?: (e: React.MouseEvent) => void;
  forwardRef?: React.Ref<ButtonElement>;
  name?: string;

  // This is only used with `<ButtonBar>`
  barId?: string;
} & ConditionalAriaLabel;

type ButtonProps = Omit<React.HTMLProps<ButtonElement>, keyof Props | 'ref' | 'label'> &
  Props;

type Url = ButtonProps['to'] | ButtonProps['href'];

function BaseButton({
  size,
  to,
  busy,
  href,
  title,
  icon,
  children,
  borderless,
  align = 'center',
  priority,
  disabled = false,
  tooltipProps,
  onClick,
  ...buttonProps
}: Props) {
  // Intercept onClick and propagate
  function handleClick(e: React.MouseEvent) {
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
  }

  function getUrl<T extends Url>(prop: T): T | undefined {
    return disabled ? undefined : prop;
  }

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.
  const button = (
    <StyledButton
      aria-disabled={disabled}
      disabled={disabled}
      to={getUrl(to)}
      href={getUrl(href)}
      size={size}
      priority={priority}
      borderless={borderless}
      {...buttonProps}
      onClick={handleClick}
      role="button"
    >
      <ButtonLabel align={align} size={size} borderless={borderless}>
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
      <Tooltip skipWrapper {...tooltipProps} title={title}>
        {button}
      </Tooltip>
    );
  }

  return button;
}

const Button = reactForwardRef<ButtonElement, ButtonProps>((props, ref) => (
  <BaseButton forwardRef={ref} {...props} />
));

Button.displayName = 'Button';

export default Button;

type StyledButtonProps = ButtonProps & {theme: Theme};

const getFontWeight = ({priority, borderless}: StyledButtonProps) =>
  `font-weight: ${priority === 'link' || borderless ? 'inherit' : 600};`;

const getBoxShadow =
  (theme: Theme) =>
  ({priority, borderless, disabled}: StyledButtonProps) => {
    if (disabled || borderless || priority === 'link') {
      return 'box-shadow: none';
    }

    return `
      box-shadow: ${theme.dropShadowLight};
      &:active {
        box-shadow: inset ${theme.dropShadowLight};
      }
    `;
  };

const getColors = ({size, priority, disabled, borderless, theme}: StyledButtonProps) => {
  const themeName = disabled ? 'disabled' : priority || 'default';
  const {
    color,
    colorActive,
    background,
    backgroundActive,
    border,
    borderActive,
    focusBorder,
    focusShadow,
  } = theme.button[themeName];

  return css`
    color: ${color};
    background-color: ${background};
    border: 1px solid ${borderless ? 'transparent' : border};

    &:hover {
      color: ${color};
    }

    ${size !== 'zero' &&
    `
    &:hover,
    &:focus,
    &:active {
      color: ${colorActive || color};
      background: ${backgroundActive};
      border-color: ${borderless ? 'transparent' : borderActive};
    }`}

    &.focus-visible {
      border: 1px solid ${focusBorder};
      box-shadow: ${focusBorder} 0 0 0 1px, ${focusShadow} 0 0 0 4px;
    }
  `;
};

const getSizeStyles = ({size, theme}: StyledButtonProps) => {
  const buttonSize = size === 'small' || size === 'xsmall' ? size : 'default';

  return {
    ...theme.form[buttonSize],
    ...theme.buttonPadding[buttonSize],
  };
};

const StyledButton = styled(
  reactForwardRef<any, ButtonProps>(
    (
      {forwardRef, size: _size, external, to, href, disabled, ...otherProps}: Props,
      forwardRefAlt
    ) => {
      // XXX: There may be two forwarded refs here, one potentially passed from a
      // wrapped Tooltip, another from callers of Button.

      const ref = mergeRefs([forwardRef, forwardRefAlt]);

      // only pass down title to child element if it is a string
      const {title, ...props} = otherProps;
      if (typeof title === 'string') {
        props[title] = title;
      }

      // Get component to use based on existence of `to` or `href` properties
      // Can be react-router `Link`, `a`, or `button`
      if (to) {
        return <Link ref={ref} to={to} disabled={disabled} {...props} />;
      }

      if (!href) {
        return <button ref={ref} disabled={disabled} {...props} />;
      }

      if (external && href) {
        return <ExternalLink ref={ref} href={href} disabled={disabled} {...props} />;
      }

      return <a ref={ref} {...props} href={href} />;
    }
  ),
  {
    shouldForwardProp: prop =>
      prop === 'forwardRef' ||
      prop === 'external' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<Props>`
  display: inline-block;
  border-radius: ${p => p.theme.button.borderRadius};
  text-transform: none;
  ${getFontWeight};
  ${getColors};
  ${getSizeStyles}
  ${p => getBoxShadow(p.theme)};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${p => (p.busy || p.disabled) && '0.65'};
  transition: background 0.1s, border 0.1s, box-shadow 0.1s;

  ${p => p.priority === 'link' && `font-size: inherit; padding: 0;`}
  ${p => p.size === 'zero' && `height: auto; min-height: auto; padding: ${space(0.25)};`}

  &:focus {
    outline: none;
  }
`;

const buttonLabelPropKeys = ['size', 'borderless', 'align'];
type ButtonLabelProps = Pick<ButtonProps, 'size' | 'borderless' | 'align'>;

const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && !buttonLabelPropKeys.includes(prop),
})<ButtonLabelProps>`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: ${p => p.align};
  white-space: nowrap;
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

  return size === 'xsmall' ? '6px' : '8px';
};

const Icon = styled('span')<IconProps & Omit<StyledButtonProps, 'theme'>>`
  display: flex;
  align-items: center;
  margin-right: ${getIconMargin};
`;

/**
 * Also export these styled components so we can use them as selectors
 */
export {StyledButton, ButtonLabel, Icon};
