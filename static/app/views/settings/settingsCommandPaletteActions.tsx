import {useMemo, type ReactNode} from 'react';
import {IconSettings} from '@sentry/icons/settings';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {t} from 'sentry/locale';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getUserNavigationConfiguration,
  getUserOrgNavigationConfiguration,
} from './organization/userOrgNavigationConfiguration';
import {FORM_FIELD_REGISTRY} from './fieldRegistry.generated';
import {getSettingsScopeTitle, type SettingsScope} from './settingsScope';
import type {NavigationSection} from './types';
import {useSettingsV3} from './useSettingsV3';

function normalizeRouteForLookup(route: string): string {
  if (route === '/settings/organization/') {
    return '/settings/:orgId/';
  }
  return route;
}

function resolveRoutePath(route: string, orgSlug: string): string {
  return replaceRouterParams(normalizeRouteForLookup(route), {orgId: orgSlug});
}

function titleFromRoute(route: string): string {
  const segment = route
    .replace(/^\/settings\//, '')
    .replace(/^:orgId\//, '')
    .replace(/^account\//, '')
    .split('/')[0];

  if (!segment) {
    return 'Settings';
  }

  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isSettingsRoute(route: string): boolean {
  if (!route.startsWith('/settings/')) {
    return false;
  }
  if (route.includes(':teamId')) {
    return false;
  }
  if (route.includes(':appId')) {
    return false;
  }
  return true;
}

type SettingsFieldEntry = {
  display: {label: string; details?: string};
  key: string;
  keywords: string[];
  to: {hash: string; pathname: string};
};

type SettingsFieldSection = {
  fields: SettingsFieldEntry[];
  key: string;
  title: string;
  icon?: ReactNode;
};

type FormFieldDefinition = (typeof FORM_FIELD_REGISTRY)[string];

function getNavItems(sections: NavigationSection[]) {
  return sections.flatMap(section => section.items);
}

type RouteDisplay = {title: string; icon?: ReactNode};

/**
 * Title and icon of each settings page, keyed by route, taken from the
 * settings navigation configuration.
 */
function getRouteDisplayMap(settingsV3: boolean): Map<string, RouteDisplay> {
  const routeDisplayMap = new Map<string, RouteDisplay>();

  if (!settingsV3) {
    for (const item of getNavItems(getUserOrgNavigationConfiguration())) {
      routeDisplayMap.set(item.path, {title: item.title, icon: item.icon});
    }
    return routeDisplayMap;
  }

  // With settings-v3, org and account pages live in separate scopes and can
  // share a title (both index pages are "General"). Titles used by more than
  // one scope are prefixed with the scope's name to tell them apart.
  const scopedItems: Array<[SettingsScope, ReturnType<typeof getNavItems>]> = [
    ['org', getNavItems(getUserOrgNavigationConfiguration({settingsV3}))],
    ['account', getNavItems(getUserNavigationConfiguration({settingsV3}))],
  ];

  const scopesByTitle = new Map<string, Set<SettingsScope>>();
  for (const [scope, items] of scopedItems) {
    for (const item of items) {
      const scopes = scopesByTitle.get(item.title) ?? new Set();
      scopes.add(scope);
      scopesByTitle.set(item.title, scopes);
    }
  }

  for (const [scope, items] of scopedItems) {
    for (const item of items) {
      const isShared = (scopesByTitle.get(item.title)?.size ?? 0) > 1;
      routeDisplayMap.set(item.path, {
        title: isShared ? `${getSettingsScopeTitle(scope)} › ${item.title}` : item.title,
        icon: item.icon,
      });
    }
  }
  return routeDisplayMap;
}

export function getSettingsFieldSections(
  orgSlug: string,
  settingsV3: boolean
): SettingsFieldSection[] {
  const routeDisplayMap = getRouteDisplayMap(settingsV3);

  const groups = new Map<string, Map<string, FormFieldDefinition>>();
  for (const field of Object.values(FORM_FIELD_REGISTRY)) {
    if (!isSettingsRoute(field.route)) {
      continue;
    }
    if (typeof field.label !== 'string' || !field.label) {
      continue;
    }

    const normalizedRoute = normalizeRouteForLookup(field.route);
    let routeFields = groups.get(normalizedRoute);
    if (!routeFields) {
      routeFields = new Map();
      groups.set(normalizedRoute, routeFields);
    }
    routeFields.set(field.name, field);
  }

  return Array.from(groups.entries())
    .map(([route, fieldMap]): SettingsFieldSection => {
      const routeDisplay = routeDisplayMap.get(route);
      const title = routeDisplay?.title ?? titleFromRoute(route);
      const resolvedPath = resolveRoutePath(route, orgSlug);

      return {
        key: route,
        title,
        icon: routeDisplay?.icon,
        fields: Array.from(fieldMap.values())
          .filter(
            (f): f is FormFieldDefinition & {label: string} =>
              typeof f.label === 'string' && f.label.length > 0
          )
          .map(f => ({
            key: `${route}#${f.name}`,
            display: {
              label: f.label,
              details: f.hintText,
            },
            keywords: ['settings', title, f.name],
            to: {
              pathname: resolvedPath,
              hash: `#${encodeURIComponent(f.name)}`,
            },
          }))
          .sort((a, b) => a.display.label.localeCompare(b.display.label)),
      };
    })
    .filter(section => section.fields.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function SettingsCommandPaletteActions() {
  const organization = useOrganization({allowNull: true});
  const settingsV3 = useSettingsV3();
  const sections = useMemo(
    () => (organization ? getSettingsFieldSections(organization.slug, settingsV3) : []),
    [organization, settingsV3]
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Settings Fields'), icon: <IconSettings />}}>
        {sections.map(section => (
          <CMDKAction
            key={section.key}
            display={{label: section.title, icon: section.icon}}
          >
            {section.fields.map(field => (
              <CMDKAction
                key={field.key}
                display={field.display}
                keywords={field.keywords}
                to={field.to}
              />
            ))}
          </CMDKAction>
        ))}
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
