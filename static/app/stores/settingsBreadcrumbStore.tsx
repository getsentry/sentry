import {PlainRoute} from 'react-router';
import Reflux from 'reflux';

import SettingsBreadcrumbActions from 'sentry/actions/settingsBreadcrumbActions';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {
  makeSafeRefluxStore,
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';

type UpdateData = {
  routes: PlainRoute<any>[];
  title: string;
};

type SettingsBreadcrumbStoreInterface = {
  getPathMap(): Internals['pathMap'];
  init(): void;
  onTrimMappings(routes: PlainRoute<any>[]): void;
  onUpdateRouteMap(update: UpdateData): void;
  reset(): void;
};

type Internals = {
  pathMap: Record<string, string>;
};

const storeConfig: Reflux.StoreDefinition &
  Internals &
  SettingsBreadcrumbStoreInterface &
  SafeStoreDefinition = {
  pathMap: {},
  unsubscribeListeners: [],

  init() {
    this.reset();
    this.unsubscribeListeners.push(
      this.listenTo(SettingsBreadcrumbActions.mapTitle, this.onUpdateRouteMap)
    );
    this.unsubscribeListeners.push(
      this.listenTo(SettingsBreadcrumbActions.trimMappings, this.onTrimMappings)
    );
  },

  reset() {
    this.pathMap = {};
  },

  getPathMap() {
    return this.pathMap;
  },

  onUpdateRouteMap({routes, title}) {
    this.pathMap[getRouteStringFromRoutes(routes)] = title;
    this.trigger(this.pathMap);
  },

  onTrimMappings(routes) {
    const routePath = getRouteStringFromRoutes(routes);
    for (const fullPath in this.pathMap) {
      if (!routePath.startsWith(fullPath)) {
        delete this.pathMap[fullPath];
      }
    }
    this.trigger(this.pathMap);
  },
};

const SettingsBreadcrumbStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as unknown as SafeRefluxStore & SettingsBreadcrumbStoreInterface;

export default SettingsBreadcrumbStore;
