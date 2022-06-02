import {PlainRoute} from 'react-router';
import {createStore} from 'reflux';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type UpdateData = {
  routes: PlainRoute<any>[];
  title: string;
};

type State = {
  pathMap: Record<string, string>;
};

interface SettingsBreadcrumbStoreDefinition extends CommonStoreDefinition<State> {
  init(): void;
  reset(): void;
  trimMappings(routes: PlainRoute<any>[]): void;
  updateRouteMap(update: UpdateData): void;
}

const storeConfig: SettingsBreadcrumbStoreDefinition = {
  pathMap: {},
  unsubscribeListeners: [],

  init() {
    this.reset();
  },

  reset() {
    this.pathMap = {};
  },

  getState() {
    return {pathMap: this.pathMap};
  },

  get() {
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
