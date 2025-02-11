import {forwardRef as reactForwardRef, useCallback} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';

import Link from './links/link';
import InteractionStateLayer from './interactionStateLayer';
import {Tooltip, type TooltipProps} from './tooltip';

/**
 * The button can actually also be an anchor or React router Link (which seems
 * to be poorly typed as `any`). So this is a bit of a workaround to receive
 * the proper html attributes.
 */
type ButtonElement = HTMLButtonElement | HTMLAnchorElement;

/**
 * Props shared across different types of button components
 */
interface CommonButtonProps {
  /**
   * Used when you want to overwrite the default Reload event key for analytics
   */
  analyticsEventKey?: string;
  /**
   * Used when you want to send an Amplitude Event. By default, Amplitude events are not sent so
   * you must pass in a eventName to send an Amplitude event.
   */
  analyticsEventName?: string;
  /**
   * Adds extra parameters to the analytics tracking
   */
  analyticsParams?: Record<string, any>;
  /**
   * Used by ButtonBar to determine active status.
   */
  barId?: string;
  /**
   * Removes borders from the button.
   */
  borderless?: boolean;
  /**
   * Indicates that the button is "doing" something.
   */
  busy?: boolean;
  /**
   * Disables the button, assigning appropriate aria attributes and disallows
   * interactions with the button.
   */
  disabled?: boolean;
  /**
   * The icon to render inside of the button. The size will be set
   * appropriately based on the size of the button.
   */
  icon?: React.ReactNode;
  /**
   * Used when the button is part of a form.
   */
  name?: string;
  /**
   * The semantic "priority" of the button. Use `primary` when the action is
   * contextually the primary action, `danger` if the button will do something
   * destructive, `link` for visual similarity to a link.
   */
  priority?: 'default' | 'primary' | 'danger' | 'link';
  /**
   * The size of the button
   */
  size?: 'zero' | 'xs' | 'sm' | 'md';
  /**
   * Display a tooltip for the button.
   */
  title?: TooltipProps['title'];
  /**
   * Additional properites for the Tooltip when `title` is set.
   */
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
  /**
   * Userful in scenarios where the border of the button should blend with the
   * background behind the button.
   */
  translucentBorder?: boolean;
}

/**
 * Helper type to extraxct the HTML element props for use in button prop
 * interfaces.
 *
 * XXX(epurkhiser): Right now all usages of this use ButtonElement, but in the
 * future ButtonElement should go away and be replaced with HTMLButtonElement
 * and HTMLAnchorElement respectively
 */
type ElementProps<E> = Omit<React.ButtonHTMLAttributes<E>, 'label' | 'size' | 'title'>;

interface BaseButtonProps extends CommonButtonProps, ElementProps<ButtonElement> {
  /**
   * The button is an external link. Similar to the `Link` `external` property.
   *
   * @deprecated Use LinkButton instead
   */
  external?: boolean;
  /**
   * @internal Used in the Button forwardRef
   */
  forwardRef?: React.Ref<ButtonElement>;
  /**
   * When set the button acts as an anchor link. Use with `external` to have
   * the link open in a new tab.
   *
   * @deprecated Use LinkButton instead
   */
  href?: string;
  /**
   * Similar to `href`, but for internal links within the app.
   *
   * @deprecated Use LinkButton instead
   */
  to?: string | Record<PropertyKey, unknown>;
}

interface ButtonPropsWithoutAriaLabel extends BaseButtonProps {
  children: React.ReactNode;
}

interface ButtonPropsWithAriaLabel extends BaseButtonProps {
  'aria-label': string;
  children?: never;
}

type ButtonProps = ButtonPropsWithoutAriaLabel | ButtonPropsWithAriaLabel;

interface BaseLinkButtonProps extends CommonButtonProps, ElementProps<ButtonElement> {
  /**
   * @internal Used in the Button forwardRef
   */
  forwardRef?: React.Ref<ButtonElement>;
}

interface ToLinkButtonProps extends BaseLinkButtonProps {
  /**
   * Similar to `href`, but for internal links within the app.
   */
  to: string | LocationDescriptor;
  external?: never;
}

interface HrefLinkButtonProps extends BaseLinkButtonProps {
  /**
   * When set the button acts as an anchor link. Use with `external` to have
   * the link open in a new tab.
   */
  href: string;
  /**
   * For use with `href` and `data:` or `blob:` schemes. Tells the browser to
   * download the contents.
   *
   * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attr-download
   */
  download?: HTMLAnchorElement['download'];
  /**
   * The button is an external link. Similar to the `Link` `external` property.
   */
  external?: boolean;
}

interface ToLinkButtonPropsWithChildren extends ToLinkButtonProps {
  children: React.ReactNode;
}

interface ToLinkButtonPropsWithAriaLabel extends ToLinkButtonProps {
  'aria-label': string;
  children?: never;
}

interface HrefLinkButtonPropsWithChildren extends HrefLinkButtonProps {
  children: React.ReactNode;
}

interface HrefLinkButtonPropsWithAriaLabel extends HrefLinkButtonProps {
  'aria-label': string;
  children?: never;
}

type LinkButtonProps =
  | ToLinkButtonPropsWithChildren
  | ToLinkButtonPropsWithAriaLabel
  | HrefLinkButtonPropsWithChildren
  | HrefLinkButtonPropsWithAriaLabel;

/**
 * Default sizes to use for SVGIcon
 */
const ICON_SIZES: Partial<
  Record<NonNullable<BaseButtonProps['size']>, SVGIconProps['size']>
> = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
};

function BaseButton({
  size = 'md',
  to,
  busy,
  href,
  title,
  icon,
  children,
  'aria-label': ariaLabel,
  borderless,
  translucentBorder,
  priority,
  disabled = false,
  tooltipProps,
  onClick,
  analyticsEventName,
  analyticsEventKey,
  analyticsParams,
  ...buttonProps
}: ButtonProps) {
  // Fallbacking aria-label to string children is not necessary as screen
  // readers natively understand that scenario. Leaving it here for a bunch of
  // our tests that query by aria-label.
  const accessibleLabel =
    ariaLabel ?? (typeof children === 'string' ? children : undefined);

  const useButtonTrackingLogger = () => {
    const hasAnalyticsDebug = window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';
    const hasCustomAnalytics = analyticsEventName || analyticsEventKey || analyticsParams;
    if (!hasCustomAnalytics || !hasAnalyticsDebug) {
      return () => {};
    }

    return () => {
      // eslint-disable-next-line no-console
      console.log('buttonAnalyticsEvent', {
        eventKey: analyticsEventKey,
        eventName: analyticsEventName,
        priority,
        href,
        ...analyticsParams,
      });
    };
  };

  const useButtonTracking =
    HookStore.get('react-hook:use-button-tracking')[0] ?? useButtonTrackingLogger;
  const buttonTracking = useButtonTracking({
    analyticsEventName,
    analyticsEventKey,
    analyticsParams: {
      priority,
      href,
      ...analyticsParams,
    },
    'aria-label': accessibleLabel || '',
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      // Don't allow clicks when disabled or busy
      if (disabled || busy) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      buttonTracking();
      onClick?.(e);
    },
    [disabled, busy, onClick, buttonTracking]
  );

  const hasChildren = Array.isArray(children)
    ? children.some(child => !isEmptyChild(child))
    : !isEmptyChild(children);

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.
  const button = (
    <StyledButton
      aria-label={accessibleLabel}
      aria-disabled={disabled}
      busy={busy}
      disabled={disabled}
      to={!disabled ? to : undefined}
      href={!disabled ? href : undefined}
      size={size}
      priority={priority}
      borderless={borderless}
      translucentBorder={translucentBorder}
      {...buttonProps}
      onClick={handleClick}
      role="button"
    >
      {priority !== 'link' && (
        <InteractionStateLayer
          higherOpacity={priority && ['primary', 'danger'].includes(priority)}
        />
      )}
      <ButtonLabel size={size} borderless={borderless}>
        {icon && (
          <Icon size={size} hasChildren={hasChildren}>
            <IconDefaultsProvider size={ICON_SIZES[size]}>{icon}</IconDefaultsProvider>
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

interface StyledButtonPropsWithAriaLabel extends ButtonPropsWithoutAriaLabel {
  theme: Theme;
}
interface StyledButtonPropsWithoutAriaLabel extends ButtonPropsWithAriaLabel {
  theme: Theme;
}

type StyledButtonProps =
  | StyledButtonPropsWithAriaLabel
  | StyledButtonPropsWithoutAriaLabel;

const getBoxShadow = ({
  priority,
  borderless,
  translucentBorder,
  disabled,
  size,
  theme,
}: StyledButtonProps) => {
  if (disabled || borderless || priority === 'link') {
    return 'box-shadow: none';
  }

  const themeName = disabled ? 'disabled' : priority || 'default';
  const {borderTranslucent} = theme.button[themeName];
  const translucentBorderString = translucentBorder
    ? `0 0 0 1px ${borderTranslucent},`
    : '';
  const dropShadow = size === 'xs' ? theme.dropShadowLight : theme.dropShadowMedium;

  return `
      box-shadow: ${translucentBorderString} ${dropShadow};
      &:active {
        box-shadow: ${translucentBorderString} inset ${dropShadow};
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
  const {color, colorActive, background, border, borderActive, focusBorder, focusShadow} =
    theme.button[themeName];

  const getFocusState = () => {
    switch (priority) {
      case 'primary':
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

  const getBackgroundColor = () => {
    switch (priority) {
      case 'primary':
      case 'danger':
        return `background-color: ${background};`;
      default:
        if (borderless) {
          return `background-color: transparent;`;
        }
        return `background-color: ${background};`;
    }
  };

  return css`
    color: ${color};
    ${getBackgroundColor()}

    border: 1px solid ${borderless || priority === 'link' ? 'transparent' : border};

    ${translucentBorder && `border-width: 0;`}

    &:hover {
      color: ${color};
    }

    ${size !== 'zero' &&
    `
      &:hover,
      &:active,
      &[aria-expanded="true"] {
        color: ${colorActive || color};
        border-color: ${borderless || priority === 'link' ? 'transparent' : borderActive};
      }

      &:focus-visible {
        color: ${colorActive || color};
        border-color: ${borderActive};
      }
    `}

    &:focus-visible {
      ${getFocusState()}
      z-index: 1;
    }
  `;
};

const getSizeStyles = ({size = 'md', translucentBorder, theme}: StyledButtonProps) => {
  const buttonSize = size === 'zero' ? 'md' : size;
  const formStyles = theme.form[buttonSize];
  const buttonPadding = theme.buttonPadding[buttonSize];

  // If using translucent borders, rewrite size styles to
  // prevent layout shifts
  const borderStyles = !translucentBorder
    ? {}
    : {
        height: formStyles.height - 2,
        minHeight: formStyles.minHeight - 2,
        paddingTop: buttonPadding.paddingTop - 1,
        paddingBottom: buttonPadding.paddingBottom - 1,
        margin: 1,
      };

  return {...formStyles, ...buttonPadding, ...borderStyles};
};

const StyledButton = styled(
  reactForwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
    (
      {
        forwardRef,
        size: _size,
        title: _title,
        external,
        to,
        href,
        disabled,
        ...props
      }: ButtonProps,
      forwardRefAlt
    ) => {
      // XXX: There may be two forwarded refs here, one potentially passed from a
      // wrapped Tooltip, another from callers of Button.

      const ref = mergeRefs([forwardRef, forwardRefAlt]);

      // Get component to use based on existence of `to` or `href` properties
      // Can be react-router `Link`, `a`, or `button`
      if (to) {
        return <Link {...props} ref={ref} to={to} disabled={disabled} />;
      }

      if (href && external) {
        return (
          <a
            {...props}
            ref={ref}
            href={href}
            aria-disabled={disabled}
            target="_blank"
            rel="noreferrer noopener"
          />
        );
      }

      if (href) {
        return <a {...props} ref={ref} href={href} />;
      }

      // The default `type` of a native button element is `submit` when inside
      // of a form. This is typically not what we want, and if we do want it we
      // should explicitly set type submit.
      props.type ??= 'button';

      return <button {...props} ref={ref} disabled={disabled} />;
    }
  ),
  {
    shouldForwardProp: prop =>
      prop === 'forwardRef' ||
      prop === 'external' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<ButtonProps>`
  position: relative;
  display: inline-block;
  border-radius: ${p => p.theme.borderRadius};
  text-transform: none;
  font-weight: ${p => p.theme.fontWeightBold};
  ${getColors};
  ${getSizeStyles};
  ${getBoxShadow};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${p => (p.busy || p.disabled) && '0.65'};
  transition:
    background 0.1s,
    border 0.1s,
    box-shadow 0.1s;

  ${p =>
    p.priority === 'link' &&
    `font-size: inherit; font-weight: inherit; padding: 0; height: auto; min-height: auto;`}
  ${p => p.size === 'zero' && `height: auto; min-height: auto; padding: ${space(0.25)};`}

  &:focus {
    outline: none;
  }
`;

const buttonLabelPropKeys = ['size', 'borderless'];
type ButtonLabelProps = Pick<ButtonProps, 'size' | 'borderless'>;

const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && !buttonLabelPropKeys.includes(prop),
})<ButtonLabelProps>`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

type ChildrenIconProps = {
  hasChildren?: boolean;
  size?: ButtonProps['size'];
};

const getIconMargin = ({size, hasChildren}: ChildrenIconProps) => {
  // If button is only an icon, then it shouldn't have margin
  if (!hasChildren) {
    return '0';
  }

  switch (size) {
    case 'xs':
    case 'zero':
      return space(0.75);
    default:
      return space(1);
  }
};

function isEmptyChild(child: React.ReactNode) {
  // truthy values are non empty
  if (child) {
    return false;
  }

  // out of the falsey values, 0 is the only one that takes space
  if (child === 0) {
    return false;
  }

  return true;
}

interface IconProps extends ChildrenIconProps, Omit<StyledButtonProps, 'theme'> {}
const Icon = styled('span')<IconProps>`
  display: flex;
  align-items: center;
  margin-right: ${getIconMargin};
  flex-shrink: 0;
`;

const LinkButton = Button as React.ComponentType<LinkButtonProps>;

export {
  Button,
  LinkButton,
  StyledButton,
  ButtonLabel,
  type ButtonProps,
  type BaseButtonProps,
  type LinkButtonProps,
};
