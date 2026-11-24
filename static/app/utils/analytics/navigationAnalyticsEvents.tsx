import type {SettingsScope} from 'sentry/views/settings/settingsScope';

/**
 * How the secondary navigation was shown when an item was clicked:
 * - `pinned`: the sidebar is expanded and stays open
 * - `peek`: it is only visible because of a hover or Right Arrow, either the
 *   nav-peek preview card or the legacy collapsed hover tray
 * - `collapsed`: the sidebar is collapsed and not showing
 */
type NavigationTrayState = 'pinned' | 'peek' | 'collapsed';

/**
 * Desktop only. Mobile has no peek, and its secondary navigation is a drawer.
 */
export type NavigationTrayAnalyticsParams = {
  nav_peek_enabled: boolean;
  tray_state: NavigationTrayState;
  /**
   * Time since the nav-peek preview card opened. Only set for clicks inside it.
   */
  ms_since_peek_open?: number;
};

export type NavigationItemClicked = {
  item: string;
  settings_scope?: SettingsScope;
} & Partial<NavigationTrayAnalyticsParams>;

type NavigationPeekTrigger = 'hover' | 'keyboard';

/**
 * Why a nav-peek preview card closed without a click on one of its links.
 * `interact_outside` also covers Escape and focus leaving the card.
 */
export type NavigationPeekDismissReason =
  | 'interact_outside'
  | 'other'
  | 'pointer_left'
  | 'primary_clicked'
  | 'switched_item';

type NavigationEventParameters = {
  'navigation.feedback_button_clicked': {seer_explorer_open: boolean; source?: string};
  'navigation.peek_dismissed': {
    item: string;
    open_ms: number;
    reason: NavigationPeekDismissReason;
    trigger: NavigationPeekTrigger;
  };
  'navigation.peek_opened': {item: string; trigger: NavigationPeekTrigger};
  'navigation.primary_item_clicked': NavigationItemClicked;
  'navigation.secondary_item_clicked': NavigationItemClicked;
  'navigation.tour_modal_dismissed': Record<string, unknown>;
  'navigation.tour_modal_shown': Record<string, unknown>;
};

type NavigationEventKey = keyof NavigationEventParameters;

export const navigationAnalyticsEventMap: Record<NavigationEventKey, string | null> = {
  'navigation.feedback_button_clicked': 'Navigation: Feedback Button Clicked',
  'navigation.peek_dismissed': 'Navigation: Peek Dismissed',
  'navigation.peek_opened': 'Navigation: Peek Opened',
  'navigation.primary_item_clicked': 'Navigation: Primary Item Clicked',
  'navigation.secondary_item_clicked': 'Navigation: Secondary Item Clicked',
  'navigation.tour_modal_dismissed': 'Navigation: Tour Modal Dismissed',
  'navigation.tour_modal_shown': 'Navigation: Tour Modal Shown',
};
