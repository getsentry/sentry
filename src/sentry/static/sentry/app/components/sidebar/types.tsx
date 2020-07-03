export type SidebarOrientation = 'top' | 'left';

export type SidebarPanelKey = 'broadcasts' | 'todos' | 'statusupdate' | '';

export type CommonSidebarProps = {
  orientation: SidebarOrientation;
  collapsed: boolean;
  showPanel: boolean;
  currentPanel: SidebarPanelKey;
  hidePanel: () => void;
  onShowPanel: () => void;
};
