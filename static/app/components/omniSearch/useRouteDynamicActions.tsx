import {useEffect, useMemo, useState} from 'react';

import {IconSettings} from 'sentry/icons';
import HookStore from 'sentry/stores/hookStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import accountSettingsNavigation from 'sentry/views/settings/account/navigationConfiguration';
import {getOrganizationNavigationConfiguration} from 'sentry/views/settings/organization/navigationConfiguration';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import projectSettingsNavigation from 'sentry/views/settings/project/navigationConfiguration';
import type {NavigationItem, NavigationSection} from 'sentry/views/settings/types';

import type {OmniAction} from './types';

type ConfigParams = {
  debugFilesNeedsReview?: boolean;
  organization?: Organization;
  project?: Project;
};

type Config = ((params: ConfigParams) => NavigationSection[]) | NavigationSection[];

// Context type for mapFunc to handle both producing the NavigationSection list
// AND filtering out items in the sections that should not be shown
type Context = Parameters<Extract<Config, (args: never) => unknown>>[0] &
  Parameters<Extract<NavigationItem['show'], (args: never) => unknown>>[0];

/**
 * Maps navigation configuration to a flattened list of navigation items
 */
const mapFunc = (config: Config, context: Context | null = null) =>
  (Array.isArray(config) ? config : context === null ? [] : config(context)).map(
    ({items}) =>
      items.filter(({show}) =>
        typeof show === 'function' && context !== null ? show(context) : true
      )
  );

/**
 * Hook that provides all navigation routes as OmniActions for the OmniSearch palette.
 * No filtering is done here - palette.tsx handles the search.
 *
 * @returns Array of all available route actions
 */
export function useRouteDynamicActions(): OmniAction[] {
  const organization = useOrganization({allowNull: true});
  const params = useParams<{orgId: string; projectId?: string}>();
  const project = useProjectFromSlug({
    organization: organization!,
    projectSlug: params.projectId,
  });
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);

  useEffect(() => {
    if (!organization) {
      setNavigationItems([]);
      return;
    }

    const context = {
      project: project ?? undefined,
      organization,
      access: new Set(organization?.access ?? []),
      features: new Set(project?.features ?? []),
    } as Context;

    const navigationFromHook = organization
      ? HookStore.get('settings:organization-navigation-config').map(cb =>
          cb(organization)
        )
      : [];

    const searchMap: NavigationItem[] = (
      prefersStackedNav(organization)
        ? [
            mapFunc(getUserOrgNavigationConfiguration, context),
            mapFunc(projectSettingsNavigation, context),
            mapFunc(navigationFromHook, context),
          ]
        : [
            mapFunc(getOrganizationNavigationConfiguration, context),
            mapFunc(accountSettingsNavigation, context),
            mapFunc(projectSettingsNavigation, context),
            mapFunc(navigationFromHook, context),
          ]
    ).flat(2);

    setNavigationItems(searchMap);
  }, [organization, project]);

  const dynamicActions = useMemo(() => {
    if (!organization) {
      return [];
    }

    const replaceParams = {...params, orgId: organization.slug};

    return navigationItems.map((item, index) => ({
      key: `route-${index}`,
      areaKey: 'navigate',
      label: item.title,
      details: item.description as string,
      section: 'Navigation',
      actionIcon: <IconSettings />,
      to: replaceRouterParams(item.path, replaceParams),
    }));
  }, [navigationItems, organization, params]);

  return dynamicActions;
}
