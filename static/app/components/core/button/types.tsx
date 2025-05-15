import type {TooltipProps} from 'sentry/components/core//tooltip';

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
   * Additional properties for the Tooltip when `title` is set.
   */
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
  /**
   * Userful in scenarios where the border of the button should blend with the
   * background behind the button.
   */
  translucentBorder?: boolean;
}
