import {PlainRoute} from 'react-router';
import {createStore, StoreDefinition} from 'reflux';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type UpdateData = {
  routes: PlainRoute<any>[];
  title: string;
};

interface SettingsBreadcrumbStoreDefinition extends StoreDefinition {
  getPathMap(): Internals['pathMap'];
  init(): void;
  reset(): void;
  trimMappings(routes: PlainRoute<any>[]): void;
  updateRouteMap(update: UpdateData): void;
}

type Internals = {
  pathMap: Record<string, string>;
};

const storeConfig: SettingsBreadcrumbStoreDefinition = {
  pathMap: {},
  unsubscribeListeners: [],

  init() {
    this.reset();
  },

  reset() {
    this.pathMap = {};
  },

  getPathMap() {
    return this.pathMap;
  },

  updateRouteMap({routes, title}) {
    this.pathMap[getRouteStringFromRoutes(routes)] = title;
    this.trigger(this.pathMap);
  },

  trimMappings(routes) {
    const routePath = getRouteStringFromRoutes(routes);
    for (const fullPath in this.pathMap) {
      if (!routePath.startsWith(fullPath)) {
        delete this.pathMap[fullPath];
      }
    }
    this.trigger(this.pathMap);
  },
};

const SettingsBreadcrumbStore = createStore(makeSafeRefluxStore(storeConfig));
export default SettingsBreadcrumbStore;
