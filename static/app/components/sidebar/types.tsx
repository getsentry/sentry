export type SidebarOrientation = 'top' | 'left';

export enum SidebarPanelKey {
  Broadcasts = 'broadcasts',
  OnboardingWizard = 'todos',
  ServiceIncidents = 'statusupdate',
  PerformanceOnboarding = 'performance_onboarding',
  ReplaysOnboarding = 'replays_onboarding',
  ProfilingOnboarding = 'profiling_onboarding',
}

export type CommonSidebarProps = {
  /**
   * Is the sidebar collapsed?
   */
  collapsed: boolean;
  /**
   * The currently shown sidebar flyout panel
   */
  currentPanel: SidebarPanelKey | '';
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
};
