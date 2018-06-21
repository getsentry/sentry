import Reflux from 'reflux';

import {stringifyRouteList} from 'app/utils';
import SettingsBreadcrumbActions from 'app/actions/settingsBreadcrumbActions';

const SettingsBreadcrumbStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(SettingsBreadcrumbActions.mapTitle, this.onUpdateRouteMap);
    this.listenTo(SettingsBreadcrumbActions.trimMappings, this.onTrimMappings);
  },

  reset() {
    this.pathMap = {};
  },

  getInitialState() {
    return this.pathMap;
  },

  onUpdateRouteMap({routes, title}) {
    this.pathMap[stringifyRouteList(routes)] = title;
    this.trigger(this.pathMap);
  },

  onTrimMappings(routes) {
    const routePath = stringifyRouteList(routes);
    for (const fullPath in this.pathMap) {
      if (!routePath.startsWith(fullPath)) delete this.pathMap[fullPath];
    }
    this.trigger(this.pathMap);
  },
});

export default SettingsBreadcrumbStore;
