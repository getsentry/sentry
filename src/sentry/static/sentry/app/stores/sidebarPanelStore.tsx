import {action, observable} from 'mobx';

import {SidebarPanelKey} from 'app/components/sidebar/types';

class SidebarPanelStore {
  @observable
  activePanel: SidebarPanelKey | '' = '';

  @action
  activatePanel(panel: SidebarPanelKey) {
    this.activePanel = this.activePanel === panel ? '' : panel;
    console.log('TEST');
  }

  @action
  hidePanel() {
    this.activePanel = '';
  }
}

const sidebarPanelStore = new SidebarPanelStore();

export default sidebarPanelStore;
