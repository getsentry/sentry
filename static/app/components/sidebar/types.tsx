import type {OnboardingDrawerKey} from 'sentry/stores/onboardingDrawerStore';

export type SidebarOrientation = 'top' | 'left';

export type CommonSidebarProps = {
  /**
   * Is the sidebar collapsed?
   */
  collapsed: boolean;
  /**
   * The currently shown sidebar flyout panel
   */
  currentPanel: OnboardingDrawerKey | '';
  /**
   * Triggered when the panel should be hidden
   */
  hidePanel: () => void;
  /**
   * Triggered when the panel should be opened
   */
  onShowPanel: () => void;
  /**
   * The orientation of the sidebar
   */
  orientation: SidebarOrientation;
  /**
   * Alternate collapsed state
   */
  hasNewNav?: boolean;
};
