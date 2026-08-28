import type {LocationDescriptor} from 'history';

import type {Responsive} from '@sentry/scraps/layout';
import type {TooltipProps} from '@sentry/scraps/tooltip';
import type {AnalyticsProps} from '@sentry/scraps/trackingContext';

export type ButtonVariant =
  | 'secondary'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'transparent';

export type ButtonSize = 'zero' | 'xs' | 'sm' | 'md';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface DO_NOT_USE_CommonButtonProps extends AnalyticsProps {
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
   * The size of the button
   */
  size?: Responsive<ButtonSize>;
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
