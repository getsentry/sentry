import isPropValid from '@emotion/is-prop-valid';
import type {SerializedStyles, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';

import {getChonkButtonStyles} from './index.chonk';

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

export interface BaseButtonProps
  extends CommonButtonProps,
    ElementProps<HTMLButtonElement | HTMLAnchorElement> {
  download?: HTMLAnchorElement['download'];
  external?: boolean;
  href?: string;
  preventScrollReset?: boolean;
  ref?: React.Ref<HTMLButtonElement | HTMLAnchorElement>;
  replace?: boolean;
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

const useButtonFunctionality = (props: ButtonProps | LinkButtonProps) => {
  // Fallbacking aria-label to string children is not necessary as screen
  // readers natively understand that scenario. Leaving it here for a bunch of
  // our tests that query by aria-label.
  const accessibleLabel =
    props['aria-label'] ??
    (typeof props.children === 'string' ? props.children : undefined);

  const useButtonTrackingLogger = () => {
    const hasAnalyticsDebug = window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';
    const hasCustomAnalytics =
      props.analyticsEventName || props.analyticsEventKey || props.analyticsParams;
    if (!hasCustomAnalytics || !hasAnalyticsDebug) {
      return () => {};
    }

    return () => {
      // eslint-disable-next-line no-console
      console.log('buttonAnalyticsEvent', {
        eventKey: props.analyticsEventKey,
        eventName: props.analyticsEventName,
        priority: props.priority,
        href: 'href' in props ? props.href : undefined,
        ...props.analyticsParams,
      });
    };
  };

  const useButtonTracking =
    HookStore.get('react-hook:use-button-tracking')[0] ?? useButtonTrackingLogger;

  const buttonTracking = useButtonTracking({
    analyticsEventName: props.analyticsEventName,
    analyticsEventKey: props.analyticsEventKey,
    analyticsParams: {
      priority: props.priority,
      href: 'href' in props ? props.href : undefined,
      ...props.analyticsParams,
    },
    'aria-label': accessibleLabel || '',
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    // Don't allow clicks when disabled or busy
    if (props.disabled || props.busy) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    buttonTracking();
    // @ts-expect-error at this point, we don't know if the button is a button or a link
    props.onClick?.(e);
  };

  const hasChildren = Array.isArray(props.children)
    ? props.children.some(child => !!child || String(child) === '0')
    : !!props.children || String(props.children) === '0';

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.

  return {
    handleClick,
    hasChildren,
    accessibleLabel,
  };
};

export function Button({
  size = 'md',
  to,
  href,
  disabled,
  type = 'button',
  tooltipProps,
  ...props
}: ButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    to,
    href,
    type,
    disabled,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={props.title} disabled={!props.title}>
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        to={disabled ? undefined : to}
        href={disabled ? undefined : href}
        size={size}
        type={type}
        {...props}
        onClick={handleClick}
        role="button"
      >
        {props.priority !== 'link' && (
          <InteractionStateLayer
            higherOpacity={
              props.priority && ['primary', 'danger'].includes(props.priority)
            }
          />
        )}
        <ButtonLabel size={size} borderless={props.borderless}>
          {props.icon && (
            <Icon size={size} hasChildren={hasChildren}>
              <IconDefaultsProvider size={ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Icon>
          )}
          {props.children}
        </ButtonLabel>
      </StyledButton>
    </Tooltip>
  );
}

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
  ({
    size: _size,
    title: _title,
    type,
    external,
    to,
    replace,
    preventScrollReset,
    href,
    disabled,
    ref,
    ...props
  }: ButtonProps) => {
    // Get component to use based on existence of `to` or `href` properties
    // Can be react-router `Link`, `a`, or `button`
    if (to) {
      return (
        <Link
          {...props}
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={to}
          replace={replace}
          preventScrollReset={preventScrollReset}
          disabled={disabled}
          role="button"
        />
      );
    }

    if (href) {
      return (
        <a
          {...props}
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          aria-disabled={disabled}
          role="button"
          {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
        />
      );
    }

    return (
      <button
        {...props}
        type={type}
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled}
      />
    );
  },
  {
    shouldForwardProp: prop =>
      prop === 'external' ||
      prop === 'replace' ||
      prop === 'preventScrollReset' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<ButtonProps>`
  ${p => (p.theme.isChonk ? getChonkButtonStyles(p as any) : getButtonStyles(p))}
`;

const getBoxShadow = ({
  priority,
  borderless,
  translucentBorder,
  disabled,
  size,
  theme,
}: StyledButtonProps | StyledLinkButtonProps): SerializedStyles => {
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
}: StyledButtonProps | StyledLinkButtonProps): SerializedStyles => {
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
}: StyledButtonProps | StyledLinkButtonProps): SerializedStyles => {
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

function getButtonStyles(p: StyledButtonProps | StyledLinkButtonProps): SerializedStyles {
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

const ButtonLabel = styled('span', {
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

export interface LinkButtonProps
  extends CommonButtonProps,
    Omit<ElementProps<HTMLAnchorElement>, 'role' | 'href'> {
  download?: HTMLAnchorElement['download'];
  external?: boolean;
  href?: string;
  preventScrollReset?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
  replace?: boolean;
  to?: string | LocationDescriptor;
}

export function LinkButton({
  size = 'md',
  to,
  href,
  disabled,
  tooltipProps,
  ...props
}: LinkButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    to,
    href,
    disabled,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={props.title} disabled={!props.title}>
      <StyledLinkButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        size={size}
        href={disabled ? undefined : href}
        to={disabled ? undefined : to}
        disabled={disabled}
        {...props}
        onClick={handleClick}
      >
        {props.priority !== 'link' && (
          <InteractionStateLayer
            higherOpacity={
              props.priority && ['primary', 'danger'].includes(props.priority)
            }
          />
        )}
        <ButtonLabel size={size} borderless={props.borderless}>
          {props.icon && (
            <Icon size={size} hasChildren={hasChildren}>
              <IconDefaultsProvider size={ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Icon>
          )}
          {props.children}
        </ButtonLabel>
      </StyledLinkButton>
    </Tooltip>
  );
}

interface StyledLinkButtonProps extends LinkButtonProps {
  theme: Theme;
}

const StyledLinkButton = styled(
  ({size: _size, title: _title, external, ...props}: LinkButtonProps) => {
    if (props.to) {
      return <Link {...props} to={props.to} role="button" />;
    }

    if (props.href) {
      return (
        <a
          {...props}
          {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
          role="button"
        />
      );
    }

    const {replace: _replace, preventScrollReset: _preventScrollReset, ...rest} = props;
    // @ts-expect-error we are spreading anchor link props on a button
    return <button {...rest} role="button" />;
  },
  {
    shouldForwardProp: prop =>
      prop === 'external' ||
      prop === 'replace' ||
      prop === 'preventScrollReset' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<LinkButtonProps>`
  ${p => (p.theme.isChonk ? getChonkButtonStyles(p as any) : getButtonStyles(p))}
`;
