import Reflux from 'reflux';

import {SidebarPanelKey} from 'app/components/sidebar/types';

import SidebarPanelActions from '../actions/sidebarPanelActions';

type SidebarPanelStoreInterface = {
  activePanel: SidebarPanelKey | '';

  onActivatePanel(panel: SidebarPanelKey): void;
  onTogglePanel(panel: SidebarPanelKey): void;
  onHidePanel(): void;
};

const sidebarPanelStoreConfig: Reflux.StoreDefinition & SidebarPanelStoreInterface = {
  activePanel: '',

  init() {
    this.listenTo(SidebarPanelActions.activatePanel, this.onActivatePanel);
    this.listenTo(SidebarPanelActions.hidePanel, this.onHidePanel);
    this.listenTo(SidebarPanelActions.togglePanel, this.onTogglePanel);
  },

  onActivatePanel(panel: SidebarPanelKey) {
    this.activePanel = panel;
    this.trigger(this.activePanel);
  },

  onTogglePanel(panel: SidebarPanelKey) {
    if (this.activePanel === panel) {
      this.onHidePanel();
    } else {
      this.onActivatePanel(panel);
    }
  },

  onHidePanel() {
    this.activePanel = '';
    this.trigger(this.activePanel);
  },
};

type SidebarPanelStore = Reflux.Store & SidebarPanelStoreInterface;

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const SidebarPanelStore = Reflux.createStore(
  sidebarPanelStoreConfig
) as SidebarPanelStore;

export default SidebarPanelStore;
