import type {LocationDescriptor} from 'history';

import type {TooltipProps} from '@sentry/scraps/tooltip';

// We do not want people using this type as it should only be used
// internally by the different button implementations
type ButtonPriority =
  | 'default'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'transparent';

export type ButtonVariant =
  | 'secondary'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'transparent';

export function DO_NOT_USE_resolveButtonVariant(
  props: Pick<DO_NOT_USE_CommonButtonProps, 'priority' | 'variant'>
): ButtonVariant {
  if (props.variant !== undefined) {
    return props.variant;
  }
  if (props.priority === 'default') {
    return 'secondary';
  }
  return props.priority ?? 'secondary';
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface DO_NOT_USE_CommonButtonProps {
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
   * @deprecated use `variant`
   */
  priority?: ButtonPriority;
  /**
   * The size of the button
   */
  size?: 'zero' | 'xs' | 'sm' | 'md';
  /**
   * Button Tooltip Props
   */
  tooltipProps?: ButtonTooltipProps;
  /**
   * The semantic "variant" of the button. Use `primary` when the action is
   * contextually the primary action, `danger` if the button will do something
   * destructive, `link` for visual similarity to a link.
   */
  variant?: ButtonVariant;
}

interface ButtonTooltipProps extends Omit<
  TooltipProps,
  'children' | 'skipWrapper' | 'title'
> {
  title?: TooltipProps['title'];
}

type ButtonElementProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'label' | 'size' | 'title'
>;

interface BaseButtonProps extends DO_NOT_USE_CommonButtonProps, ButtonElementProps {
  ref?: React.Ref<HTMLButtonElement>;
}

interface ButtonPropsWithoutAriaLabel extends BaseButtonProps {
  children: React.ReactNode;
}

interface ButtonPropsWithAriaLabel extends BaseButtonProps {
  'aria-label': string;
  children?: never;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export type DO_NOT_USE_ButtonProps =
  | ButtonPropsWithoutAriaLabel
  | ButtonPropsWithAriaLabel;

type LinkElementProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'label' | 'size' | 'title' | 'href' | 'target'
>;

interface BaseLinkButtonProps extends DO_NOT_USE_CommonButtonProps, LinkElementProps {
  /**
   * Determines if the link is disabled.
   */
  disabled?: boolean;
}

interface LinkButtonPropsWithHref extends BaseLinkButtonProps {
  href: string;
  /**
   * Determines if the link is external. External links always open in a new tab.
   */
  external?: boolean;
}

interface LinkButtonPropsWithTo extends BaseLinkButtonProps {
  to: string | LocationDescriptor;
  /**
   * Opens the link in a new tab. Use sparingly — internal links typically
   * should not open in a new tab. For external links, use `href` with
   * `external` instead, which always opens in a new tab.
   */
  openInNewTab?: boolean;
  /**
   * If true, the link will not reset the scroll position of the page when clicked.
   */
  preventScrollReset?: boolean;
  /**
   * Determines if the link should replace the current history entry.
   */
  replace?: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export type DO_NOT_USE_LinkButtonProps = LinkButtonPropsWithHref | LinkButtonPropsWithTo;
