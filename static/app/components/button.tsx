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

interface BaseButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<ButtonElement>,
    'ref' | 'label' | 'size' | 'title'
  > {
  align?: 'center' | 'left' | 'right';
  // This is only used with `<ButtonBar>`
  barId?: string;
  borderless?: boolean;
  busy?: boolean;
  disabled?: boolean;
  download?: HTMLAnchorElement['download'];
  external?: boolean;
  forwardRef?: React.Ref<ButtonElement>;
  href?: string;
  icon?: React.ReactNode;
  name?: string;
  onClick?: (e: React.MouseEvent) => void;
  priority?: 'default' | 'primary' | 'danger' | 'link' | 'success' | 'form';
  rel?: HTMLAnchorElement['rel'];
  size?: 'zero' | 'xsmall' | 'small';
  target?: HTMLAnchorElement['target'];
  title?: React.ComponentProps<typeof Tooltip>['title'];
  to?: string | object;
  tooltipProps?: Omit<Tooltip['props'], 'children' | 'title' | 'skipWrapper'>;
  translucentBorder?: boolean;
}

export interface ButtonPropsWithoutAriaLabel extends BaseButtonProps {
  children: React.ReactNode;
}
export interface ButtonPropsWithAriaLabel extends BaseButtonProps {
  'aria-label': string;
  children?: never;
}

export type ButtonProps = ButtonPropsWithoutAriaLabel | ButtonPropsWithAriaLabel;

type Url = ButtonProps['to'] | ButtonProps['href'];

function BaseButton({
  size,
  to,
  busy,
  href,
  title,
  icon,
  children,
  'aria-label': ariaLabel,
  borderless,
  translucentBorder,
  align = 'center',
  priority,
  disabled = false,
  tooltipProps,
  onClick,
  ...buttonProps
}: ButtonProps) {
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

  // Fallbacking aria-label to string children is not necessary as screen readers natively understand that scenario.
  // Leaving it here for a bunch of our tests that query by aria-label.
  const screenReaderLabel =
    ariaLabel || (typeof children === 'string' ? children : undefined);

  const hasChildren = Array.isArray(children)
    ? children.some(child => !!child)
    : !!children;

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.
  const button = (
    <StyledButton
      aria-label={screenReaderLabel}
      aria-disabled={disabled}
      disabled={disabled}
      to={getUrl(to)}
      href={getUrl(href)}
      size={size}
      priority={priority}
      borderless={borderless}
      translucentBorder={translucentBorder}
      {...buttonProps}
      onClick={handleClick}
      role="button"
    >
      <ButtonLabel align={align} size={size} borderless={borderless}>
        {icon && (
          <Icon size={size} hasChildren={hasChildren}>
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

const getBoxShadow = ({
  priority,
  borderless,
  translucentBorder,
  disabled,
  theme,
}: StyledButtonProps) => {
  const themeName = disabled ? 'disabled' : priority || 'default';
  const {borderTranslucent} = theme.button[themeName];
  const translucentBorderString = translucentBorder
    ? `0 0 0 1px ${borderTranslucent},`
    : '';

  if (disabled || borderless || priority === 'link') {
    return 'box-shadow: none';
  }

  return `
      box-shadow: ${translucentBorderString} ${theme.dropShadowLight};
      &:active {
        box-shadow: ${translucentBorderString} inset ${theme.dropShadowLight};
      }
    `;
};

const getColors = ({
  size,
  priority,
  disabled,
  borderless,
  translucentBorder,
  theme,
}: StyledButtonProps) => {
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

  const getFocusState = () => {
    switch (priority) {
      case 'primary':
      case 'success':
      case 'danger':
        return `
          border-color: ${focusBorder};
          box-shadow: ${focusBorder} 0 0 0 1px, ${focusShadow} 0 0 0 4px;`;
      default:
        if (translucentBorder) {
          return `
            border-color: ${focusBorder};
            box-shadow: ${focusBorder} 0 0 0 2px;`;
        }
        return `
          border-color: ${focusBorder};
          box-shadow: ${focusBorder} 0 0 0 1px;`;
    }
  };

  return css`
    color: ${color};
    background-color: ${background};

    border: 1px solid ${borderless ? 'transparent' : border};

    ${translucentBorder && `border-width: 0;`}

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
      ${getFocusState()}
      z-index: 1;
    }
  `;
};

const getSizeStyles = ({size, translucentBorder, theme}: StyledButtonProps) => {
  const buttonSize = size === 'small' || size === 'xsmall' ? size : 'default';
  const formStyles = theme.form[buttonSize];
  const buttonPadding = theme.buttonPadding[buttonSize];

  return {
    ...formStyles,
    ...buttonPadding,
    // If using translucent borders, rewrite size styles to
    // prevent layout shifts
    ...(translucentBorder && {
      height: formStyles.height - 2,
      minHeight: formStyles.minHeight - 2,
      paddingTop: buttonPadding.paddingTop - 1,
      paddingBottom: buttonPadding.paddingBottom - 1,
      margin: 1,
    }),
  };
};

const StyledButton = styled(
  reactForwardRef<any, ButtonProps>(
    (
      {forwardRef, size: _size, external, to, href, disabled, ...otherProps}: ButtonProps,
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
)<ButtonProps>`
  display: inline-block;
  border-radius: ${p => p.theme.button.borderRadius};
  text-transform: none;
  ${getFontWeight};
  ${getColors};
  ${getSizeStyles}
  ${getBoxShadow};
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
  hasChildren?: boolean;
  size?: ButtonProps['size'];
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
