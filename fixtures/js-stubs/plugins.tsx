import {Plugin} from 'sentry-fixture/plugin';

import {Plugin as PluginType} from 'sentry/types';

export function Plugins(params: PluginType[] = []): PluginType[] {
  return [
    Plugin(),
    Plugin({
      enabled: true,
      id: 'github',
      name: 'GitHub',
      slug: 'github',
      canDisable: false,
      hasConfiguration: false,
    }),
    Plugin({
      enabled: false,
      isHidden: true,
      name: 'Hidden Plugin',
      slug: 'hidden-plugin',
      id: 'hidden-plugin',
    }),
    ...params,
  ];
}
