import LegacyConfigStore, {ConfigStoreDefinition} from 'sentry/stores/configStore';

import {createStoreProvider} from '../providers/createStoreProvider';

const actions = {
  set: LegacyConfigStore.set,
  updateTheme: LegacyConfigStore.updateTheme,
};

export const [ConfigProvider, useConfigStore] = createStoreProvider<
  ConfigStoreDefinition['config'],
  typeof LegacyConfigStore,
  typeof actions
>({
  name: 'ConfigStore',
  store: LegacyConfigStore,
  actions,
});
