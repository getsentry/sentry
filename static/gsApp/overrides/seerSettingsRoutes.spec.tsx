import {matchRoutes} from 'react-router';

import {translateSentryRoute} from 'sentry/utils/reactRouter6Compat/router';
import type {SettingsBreadcrumb} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import {seerSettingsRoutes} from './seerSettingsRoutes';

describe('seerSettingsRoutes', () => {
  it.each([
    ['trial/', ['Settings']],
    ['', ['Settings', 'Seer']],
    ['connectors/', ['Settings', 'Seer']],
    ['projects/', ['Settings', 'Seer']],
    ['projects/javascript/', ['Settings', 'Seer', 'Autofix']],
    ['projects/defaults/', ['Settings', 'Seer', 'Autofix']],
    ['repos/', ['Settings', 'Seer']],
    ['repos/repo-1/', ['Settings', 'Seer', 'Code Review']],
    ['repos/defaults/', ['Settings', 'Seer', 'Code Review']],
  ])('composes parent breadcrumbs for %s', (path, labels) => {
    const routes = [
      translateSentryRoute({
        path: '/settings/:orgId/',
        handle: {
          settingsBreadcrumb: {type: 'link', label: 'Settings', to: '/settings/'},
        },
        children: [seerSettingsRoutes()],
      }),
    ];
    const matches = matchRoutes(routes, `/settings/org-slug/seer/${path}`);
    const items: SettingsBreadcrumb[] =
      matches?.flatMap(match => match.route.handle?.settingsBreadcrumb ?? []) ?? [];

    expect(items.map(item => (item.type === 'link' ? item.label : item.type))).toEqual(
      labels
    );
  });
});
