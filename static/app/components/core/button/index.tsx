import {forwardRef as reactForwardRef, useCallback} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import type {SerializedStyles, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Tooltip, type TooltipProps} from 'sentry/components/tooltip';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';

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
   * The icon to render inside of the button. The size will be set
   * appropriately based on the size of the button.
   */
  icon?: React.ReactNode;
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

export interface BaseButtonProps extends CommonButtonProps, ElementProps<ButtonElement> {
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
   * @deprecated Use LinkButton instead
   */
  replace?: boolean;
  /**
   * Similar to `href`, but for internal links within the app.
   *
   * @deprecated Use LinkButton instead
   */
  to?: string | LocationDescriptor;
}

interface ButtonPropsWithoutAriaLabel extends BaseButtonProps {
  children: React.ReactNode;
}

interface ButtonPropsWithAriaLabel extends BaseButtonProps {
  'aria-label': string;
  children?: never;
}

export type ButtonProps = ButtonPropsWithoutAriaLabel | ButtonPropsWithAriaLabel;

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
  replace?: boolean;
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

export type LinkButtonProps =
  | ToLinkButtonPropsWithChildren
  | ToLinkButtonPropsWithAriaLabel
  | HrefLinkButtonPropsWithChildren
  | HrefLinkButtonPropsWithAriaLabel;

function BaseButton({
  size = 'md',
  to,
  replace,
  busy,
  href,
  title,
  icon,
  children,
  'aria-label': ariaLabel,
  borderless,
  translucentBorder,
  priority,
  disabled,
  type = 'button',
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
    ? children.some(child => !!child || String(child) === '0')
    : !!children || String(children) === '0';

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.
  return (
    <Tooltip skipWrapper {...tooltipProps} title={title} disabled={!title}>
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        busy={busy}
        disabled={disabled}
        to={disabled ? undefined : to}
        href={disabled ? undefined : href}
        replace={replace}
        size={size}
        priority={priority}
        borderless={borderless}
        translucentBorder={translucentBorder}
        type={type}
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
    </Tooltip>
  );
}

export const Button = reactForwardRef<ButtonElement, ButtonProps>((props, ref) => (
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

export const StyledButton = styled(
  reactForwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
    (
      {
        forwardRef,
        size: _size,
        title: _title,
        type,
        external,
        to,
        replace,
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
        return (
          <Link {...props} ref={ref} to={to} replace={replace} disabled={disabled} />
        );
      }

      if (href) {
        return (
          <a
            {...props}
            ref={ref}
            href={href}
            aria-disabled={disabled}
            {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
          />
        );
      }

      return <button {...props} type={type} ref={ref} disabled={disabled} />;
    }
  ),
  {
    shouldForwardProp: prop =>
      prop === 'forwardRef' ||
      prop === 'external' ||
      prop === 'replace' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<ButtonProps>`
  ${getButtonStyles}
`;

const getBoxShadow = ({
  priority,
  borderless,
  translucentBorder,
  disabled,
  size,
  theme,
}: StyledButtonProps): SerializedStyles => {
  if (disabled || borderless || priority === 'link') {
    return css`
      box-shadow: none;
    `;
  }

  const themeName = disabled ? 'disabled' : priority || 'default';
  const {borderTranslucent} = theme.button[themeName];
  const translucentBorderString = translucentBorder
    ? `0 0 0 1px ${borderTranslucent},`
    : '';
  const dropShadow = size === 'xs' ? theme.dropShadowLight : theme.dropShadowMedium;

  return css`
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
}: StyledButtonProps): SerializedStyles => {
  const themeName = disabled ? 'disabled' : priority || 'default';
  const {color, colorActive, background, border, borderActive, focusBorder, focusShadow} =
    theme.button[themeName];

  const getFocusState = (): SerializedStyles => {
    switch (priority) {
      case 'primary':
      case 'danger':
        return css`
          border-color: ${focusBorder};
          box-shadow:
            ${focusBorder} 0 0 0 1px,
            ${focusShadow} 0 0 0 4px;
        `;
      default:
        if (translucentBorder) {
          return css`
            border-color: ${focusBorder};
            box-shadow: ${focusBorder} 0 0 0 2px;
          `;
        }
        return css`
          border-color: ${focusBorder};
          box-shadow: ${focusBorder} 0 0 0 1px;
        `;
    }
  };

  return css`
    color: ${color};
    background-color: ${priority === 'primary' || priority === 'danger'
      ? background
      : borderless
        ? 'transparent'
        : background};

    border: 1px solid ${borderless || priority === 'link' ? 'transparent' : border};

    ${translucentBorder &&
    css`
      border-width: 0;
    `}

    &:hover {
      color: ${color};
    }

    ${size !== 'zero' &&
    css`
      &:hover,
      &:active,
      &[aria-expanded='true'] {
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

const getSizeStyles = ({
  size = 'md',
  translucentBorder,
  theme,
}: StyledButtonProps): SerializedStyles => {
  const buttonSize = size === 'zero' ? 'md' : size;
  const formStyles = theme.form[buttonSize];
  const buttonPadding = theme.buttonPadding[buttonSize];

  // If using translucent borders, rewrite size styles to
  // prevent layout shifts
  const borderStyles = translucentBorder
    ? {
        height: `calc(${formStyles.height} - 2px)`,
        minHeight: `calc(${formStyles.minHeight} - 2px)`,
        paddingTop: buttonPadding.paddingTop - 1,
        paddingBottom: buttonPadding.paddingBottom - 1,
        margin: 1,
      }
    : {};

  return css`
    ${formStyles}
    ${buttonPadding}
    ${borderStyles}
  `;
};

function getButtonStyles(p: StyledButtonProps & {theme: Theme}): SerializedStyles {
  return css`
    position: relative;
    display: inline-block;
    border-radius: ${p.theme.borderRadius};
    text-transform: none;
    font-weight: ${p.theme.fontWeightBold};
    cursor: ${p.disabled ? 'not-allowed' : 'pointer'};
    opacity: ${(p.busy || p.disabled) && '0.65'};

    ${getColors(p)}
    ${getSizeStyles(p)}
    ${getBoxShadow(p)}

    transition:
      background 0.1s,
      border 0.1s,
      box-shadow 0.1s;

    ${p.priority === 'link' &&
    css`
      font-size: inherit;
      font-weight: inherit;
      padding: 0;
      height: auto;
      min-height: auto;
    `}
    ${p.size === 'zero' &&
    css`
      height: auto;
      min-height: auto;
      padding: ${space(0.25)};
    `}

  &:focus {
      outline: none;
    }
  `;
}

export const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['size', 'borderless'].includes(prop),
})<Pick<ButtonProps, 'size' | 'borderless'>>`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

const Icon = styled('span')<{hasChildren?: boolean; size?: ButtonProps['size']}>`
  display: flex;
  align-items: center;
  margin-right: ${p =>
    p.hasChildren
      ? p.size === 'xs' || p.size === 'zero'
        ? space(0.75)
        : space(1)
      : '0'};
  flex-shrink: 0;
`;

export const LinkButton = Button as React.ComponentType<LinkButtonProps>;
