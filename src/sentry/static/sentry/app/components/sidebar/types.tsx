export type SidebarOrientation = 'top' | 'left';

export enum SidebarPanelKey {
  Broadcasts = 'broadcasts',
  OnboardingWizard = 'todos',
  StatusUpdate = 'statusupdate',
}

export type CommonSidebarProps = {
  orientation: SidebarOrientation;
  collapsed: boolean;
  currentPanel: SidebarPanelKey | '';
  hidePanel: () => void;
  onShowPanel: () => void;
};
