import type {LocationDescriptor} from 'history';

import type {TooltipProps} from 'sentry/components/core/tooltip';

// We do not want people using this type as it should only be used
// internally by the different button implementations

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
  priority?: 'default' | 'primary' | 'danger' | 'warning' | 'link' | 'transparent';
  /**
   * The size of the button
   */
  size?: 'zero' | 'xs' | 'sm' | 'md';
  /**
   * Display a tooltip for the button.
   */
  title?: TooltipProps['title'];
  /**
   * Additional properties for the Tooltip when `title` is set.
   */
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
  /**
   * Userful in scenarios where the border of the button should blend with the
   * background behind the button.
   */
  translucentBorder?: boolean;
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
  'label' | 'size' | 'title' | 'href'
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
   * Determines if the link is external and should open in a new tab.
   */
  external?: boolean;
}

interface LinkButtonPropsWithTo extends BaseLinkButtonProps {
  to: string | LocationDescriptor;
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
