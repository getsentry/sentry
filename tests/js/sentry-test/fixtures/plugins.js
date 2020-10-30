import {Plugin} from './plugin';

export function Plugins(params = []) {
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
