import {useCallback, useEffect, useMemo, useState} from 'react';

import HookStore from 'sentry/stores/hookStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import projectSettingsNavigation from 'sentry/views/settings/project/navigationConfiguration';
import type {NavigationItem, NavigationSection} from 'sentry/views/settings/types';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs, strGetFn} from './utils';

type ConfigParams = {
  debugFilesNeedsReview?: boolean;
  organization?: Organization;
  project?: Project;
};

type Config = ((params: ConfigParams) => NavigationSection[]) | NavigationSection[];

// XXX(epurkhiser): We use the context in mapFunc to handle both producing the
// NavigationSection list AND filtering out items in the sections that should
// not be shown using the `show` attribute of the NavigationItem
type Context = Parameters<Extract<Config, (args: never) => unknown>>[0] &
  Parameters<Extract<NavigationItem['show'], (args: never) => unknown>>[0];

/**
 * navigation configuration can currently be either:
 *
 *  - an array of {name: string, items: Array<{NavItem}>} OR
 *  - a function that returns the above
 *    (some navigation items require additional context, e.g. a badge based on
 *    a `project` property)
 *
 * We need to go through all navigation configurations and get a flattened list
 * of all navigation item objects
 */
const mapFunc = (config: Config, context: Context | null = null) =>
  (Array.isArray(config) ? config : context === null ? [] : config(context)).map(
    ({items}) =>
      items.filter(({show}) =>
        typeof show === 'function' && context !== null ? show(context) : true
      )
  );

interface Props {
  children: (props: ChildProps) => React.ReactNode;
  query: string;
  searchOptions?: Fuse.IFuseOptions<NavigationItem>;
}

function RouteSource({searchOptions, query, children}: Props) {
  const params = useParams();
  const organization = useOrganization({allowNull: true});
  const project = useProjectFromSlug({organization, projectSlug: params.projectId});

  const resolvedTs = useMemo(() => makeResolvedTs(), []);
  const [fuzzy, setFuzzy] = useState<Fuse<NavigationItem> | null>(null);

  const createSearch = useCallback(async () => {
    const context = {
      project,
      organization,
      access: new Set(organization?.access ?? []),
      features: new Set(project?.features ?? []),
    } as Context;

    const navigationFromHook = organization
      ? HookStore.get('settings:organization-navigation-config').map(cb =>
          cb(organization)
        )
      : [];

    const searchMap: NavigationItem[] = [
      mapFunc(getUserOrgNavigationConfiguration, context),
      mapFunc(projectSettingsNavigation, context),
      mapFunc(navigationFromHook, context),
    ].flat(2);

    const search = await createFuzzySearch(searchMap, {
      ...searchOptions,
      keys: ['title', 'description'],
      getFn: strGetFn,
    });

    setFuzzy(search);
  }, [organization, project, searchOptions]);

  useEffect(() => void createSearch(), [createSearch]);

  const replaceParams = useMemo(
    () => ({...params, orgId: organization?.slug}),
    [organization?.slug, params]
  );

  const results = useMemo(() => {
    if (!organization) {
      return [];
    }

    return (
      fuzzy?.search(query).map(({item, ...rest}) => ({
        item: {
          ...item,
          sourceType: 'route',
          resultType: 'route',
          to: replaceRouterParams(item.path, replaceParams),
          resolvedTs,
        } as ResultItem,
        ...rest,
      })) ?? []
    );
  }, [fuzzy, organization, query, replaceParams, resolvedTs]);

  return children({isLoading: fuzzy === undefined, results});
}

export default RouteSource;
