import Reflux from 'reflux';

import SidebarPanelActions from 'sentry/actions/sidebarPanelActions';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {makeSafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreInterface} from './types';

type ActivePanelType = SidebarPanelKey | '';

type SidebarPanelStoreInterface = CommonStoreInterface<ActivePanelType> & {
  activePanel: ActivePanelType;

  onActivatePanel(panel: SidebarPanelKey): void;
  onHidePanel(): void;
  onTogglePanel(panel: SidebarPanelKey): void;
};

const storeConfig: Reflux.StoreDefinition &
  SidebarPanelStoreInterface &
  SafeStoreDefinition = {
  activePanel: '',
  unsubscribeListeners: [],

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(SidebarPanelActions.activatePanel, this.onActivatePanel)
    );
    this.unsubscribeListeners.push(
      this.listenTo(SidebarPanelActions.hidePanel, this.onHidePanel)
    );
    this.unsubscribeListeners.push(
      this.listenTo(SidebarPanelActions.togglePanel, this.onTogglePanel)
    );
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
const SidebarPanelStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SidebarPanelStoreInterface;

export default SidebarPanelStore;
