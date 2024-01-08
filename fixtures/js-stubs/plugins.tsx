import {PluginFixture} from 'sentry-fixture/plugin';

import {Plugin} from 'sentry/types';

export function PluginsFixture(params: Plugin[] = []): Plugin[] {
  return [
    PluginFixture(),
    PluginFixture({
      enabled: true,
      id: 'github',
      name: 'GitHub',
      slug: 'github',
      canDisable: false,
      hasConfiguration: false,
    }),
    PluginFixture({
      enabled: false,
      isHidden: true,
      name: 'Hidden Plugin',
      slug: 'hidden-plugin',
      id: 'hidden-plugin',
    }),
    ...params,
  ];
}
