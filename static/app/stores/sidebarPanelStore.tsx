import Reflux from 'reflux';

import SidebarPanelActions from 'sentry/actions/sidebarPanelActions';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';

import {CommonStoreInterface} from './types';

type ActivePanelType = SidebarPanelKey | '';

type SidebarPanelStoreInterface = CommonStoreInterface<ActivePanelType> & {
  activePanel: ActivePanelType;

  onActivatePanel(panel: SidebarPanelKey): void;
  onTogglePanel(panel: SidebarPanelKey): void;
  onHidePanel(): void;
};

const storeConfig: Reflux.StoreDefinition & SidebarPanelStoreInterface = {
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

  getState() {
    return this.activePanel;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const SidebarPanelStore = Reflux.createStore(storeConfig) as Reflux.Store &
  SidebarPanelStoreInterface;

export default SidebarPanelStore;
