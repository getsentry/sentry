import type {LocationDescriptor} from 'history';

import type {TooltipProps} from '@sentry/scraps/tooltip';

export type ButtonVariant =
  | 'secondary'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'link'
  | 'transparent';

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
   * Indicator if the button should be disabled
   */
  disabled?: boolean;
  /**
   * The icon to render inside of the button. The size will be set
   * appropriately based on the size of the button.
   */
  icon?: React.ReactNode;
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

// ── Action button (no href → renders <button>) ──────────────────────

type ActionElementProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'label' | 'size' | 'title'
>;

interface ActionButtonBase extends DO_NOT_USE_CommonButtonProps, ActionElementProps {
  href?: never;
  openInNewTab?: never;
  preventScrollReset?: never;
  ref?: React.Ref<HTMLButtonElement>;
  replace?: never;
}

interface ActionButtonWithChildren extends ActionButtonBase {
  children: React.ReactNode;
}

interface ActionButtonWithAriaLabel extends ActionButtonBase {
  'aria-label': string;
  children?: never;
}

type ActionButtonProps = ActionButtonWithChildren | ActionButtonWithAriaLabel;

// ── Navigation button (href present → renders <a> / Link) ───────────

type NavElementProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'label' | 'size' | 'title' | 'href' | 'target'
>;

interface NavButtonBase extends DO_NOT_USE_CommonButtonProps, NavElementProps {
  /**
   * The URL to navigate to. Accepts a string URL or a react-router
   * LocationDescriptor. When present, the button renders as an anchor.
   *
   * External URLs (http://, https://, or protocol-relative) are
   * automatically detected — `target="_blank"` and security attributes
   * are added unless `openInNewTab` is explicitly set to `false`.
   */
  href: string | LocationDescriptor;
  /**
   * Controls whether the link opens in a new tab.
   *
   * - For external URLs, defaults to `true`.
   * - For internal URLs, defaults to `false`.
   *
   * Set explicitly to override the default behavior.
   */
  openInNewTab?: boolean;
  /**
   * If true, the link will not reset the scroll position of the page when clicked.
   */
  preventScrollReset?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
  /**
   * Determines if the link should replace the current history entry.
   */
  replace?: boolean;
}

interface NavButtonWithChildren extends NavButtonBase {
  children: React.ReactNode;
}

interface NavButtonWithAriaLabel extends NavButtonBase {
  'aria-label': string;
  children?: never;
}

type NavButtonProps = NavButtonWithChildren | NavButtonWithAriaLabel;

// ── Exported union ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
export type DO_NOT_USE_ButtonProps = ActionButtonProps | NavButtonProps;

// ── Legacy LinkButton types (unchanged) ─────────────────────────────

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
