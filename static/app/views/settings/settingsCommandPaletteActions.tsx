import {useMemo, type ReactNode} from 'react';

import {FORM_FIELD_REGISTRY} from '@sentry/scraps/form';

import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {IconLock, IconMail, IconSettings, IconSubscribed, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';

const ROUTE_ICONS: Record<string, ReactNode> = {
  '/settings/account/details/': <IconUser />,
  '/settings/account/security/': <IconLock />,
  '/settings/account/notifications/': <IconSubscribed />,
  '/settings/account/emails/': <IconMail />,
  '/settings/:orgId/': <IconSettings />,
  '/settings/:orgId/security-and-privacy/': <IconLock />,
};

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
  if (route.includes(':projectId')) {
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

function getSettingsFieldSections(orgSlug: string): SettingsFieldSection[] {
  const routeTitleMap = new Map<string, string>();
  for (const section of getUserOrgNavigationConfiguration()) {
    for (const item of section.items) {
      routeTitleMap.set(item.path, item.title);
    }
  }

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
      const title = routeTitleMap.get(route) ?? titleFromRoute(route);
      const resolvedPath = resolveRoutePath(route, orgSlug);

      return {
        key: route,
        title,
        icon: ROUTE_ICONS[route],
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
  const sections = useMemo(
    () => (organization ? getSettingsFieldSections(organization.slug) : []),
    [organization]
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
