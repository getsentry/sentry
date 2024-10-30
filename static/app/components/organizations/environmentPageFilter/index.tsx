import {useCallback, useMemo} from 'react';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import type {HybridFilterProps} from 'sentry/components/organizations/hybridFilter';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

import {DesyncedFilterMessage} from '../pageFilters/desyncedFilter';

import {EnvironmentPageFilterTrigger} from './trigger';

export interface EnvironmentPageFilterProps
  extends Partial<
    Omit<
      HybridFilterProps<string>,
      | 'searchable'
      | 'multiple'
      | 'options'
      | 'value'
      | 'defaultValue'
      | 'onReplace'
      | 'onToggle'
      | 'menuBody'
      | 'menuFooter'
      | 'menuFooterMessage'
      | 'checkboxWrapper'
      | 'shouldCloseOnInteractOutside'
    >
  > {
  /**
   * Message to show in the menu footer
   */
  footerMessage?: React.ReactNode;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function EnvironmentPageFilter({
  onChange,
  onReset,
  disabled,
  sizeLimit,
  sizeLimitMessage,
  emptyMessage,
  menuTitle,
  menuWidth,
  trigger,
  resetParamsOnChange,
  footerMessage,
  triggerProps = {},
  ...selectProps
}: EnvironmentPageFilterProps) {
  const router = useRouter();
  const organization = useOrganization();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const {
    selection: {projects: projectPageFilterValue, environments: envPageFilterValue},
    isReady: pageFilterIsReady,
    desyncedFilters,
  } = usePageFilters();

  const environments = useMemo<string[]>(() => {
    const isSuperuser = isActiveSuperuser();

    const unsortedEnvironments = projects.flatMap(project => {
      const projectId = parseInt(project.id, 10);
      // Include environments from:
      // - all projects if the user is a superuser
      // - the requested projects
      // - all member projects if 'my projects' (empty list) is selected.
      // - all projects if -1 is the only selected project.
      if (
        (projectPageFilterValue.includes(ALL_ACCESS_PROJECTS) && project.hasAccess) ||
        (projectPageFilterValue.length === 0 && (project.isMember || isSuperuser)) ||
        projectPageFilterValue.includes(projectId)
      ) {
        return project.environments;
      }

      return [];
    });

    const uniqueUnsortedEnvironments = Array.from(new Set(unsortedEnvironments));

    // Sort with the last selected environments at the top
    return sortBy(uniqueUnsortedEnvironments, env => [
      !envPageFilterValue.includes(env),
      env,
    ]);
  }, [projects, projectPageFilterValue, envPageFilterValue]);

  /**
   * Validated values that only includes the currently available environments
   * (availability may change based on which projects are selected.)
   */
  const value = useMemo(
    () => envPageFilterValue.filter(env => environments.includes(env)),
    [envPageFilterValue, environments]
  );

  const handleChange = useCallback(
    async (newValue: string[]) => {
      if (isEqual(newValue, envPageFilterValue)) {
        return;
      }

      onChange?.(newValue);

      trackAnalytics('environmentselector.update', {
        count: newValue.length,
        path: getRouteStringFromRoutes(router.routes),
        organization,
      });

      // Wait for the menu to close before calling onChange
      await new Promise(resolve => setTimeout(resolve, 0));

      updateEnvironments(newValue, router, {
        save: true,
        resetParams: resetParamsOnChange,
      });
    },
    [envPageFilterValue, resetParamsOnChange, router, organization, onChange]
  );

  const onToggle = useCallback(
    newValue => {
      trackAnalytics('environmentselector.toggle', {
        action: newValue.length > value.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(router.routes),
        organization,
      });
    },
    [value, router.routes, organization]
  );

  const onReplace = useCallback(() => {
    trackAnalytics('environmentselector.direct_selection', {
      path: getRouteStringFromRoutes(router.routes),
      organization,
    });
  }, [router.routes, organization]);

  const options = useMemo(
    () =>
      environments.map(env => ({
        value: env,
        label: env,
      })),
    [environments]
  );

  const desynced = desyncedFilters.has('environments');
  const defaultMenuWidth = useMemo(() => {
    // EnvironmentPageFilter will try to expand to accommodate the longest env slug
    const longestSlugLength = options
      .slice(0, 25)
      .reduce(
        (acc, cur) => (String(cur.label).length > acc ? String(cur.label).length : acc),
        0
      );

    // Calculate an appropriate width for the menu. It should be between 16 (22 if
    // there's a desynced message) and 24em. Within that range, the width is a function
    // of the length of the longest slug. The environment slugs take up to
    // (longestSlugLength * 0.6)em of horizontal space (each character occupies roughly
    // 0.6em). We also need to add 6em to account for the checkbox and menu paddings.
    return `${Math.max(desynced ? 22 : 16, Math.min(24, longestSlugLength * 0.6 + 6))}em`;
  }, [options, desynced]);

  return (
    <HybridFilter
      {...selectProps}
      searchable
      multiple
      options={options}
      value={value}
      defaultValue={[]}
      onChange={handleChange}
      onReset={onReset}
      onReplace={onReplace}
      onToggle={onToggle}
      disabled={disabled ?? (!projectsLoaded || !pageFilterIsReady)}
      sizeLimit={sizeLimit ?? 25}
      sizeLimitMessage={sizeLimitMessage ?? t('Use search to find more environments…')}
      emptyMessage={emptyMessage ?? t('No environments found')}
      menuTitle={menuTitle ?? t('Filter Environments')}
      menuWidth={menuWidth ?? defaultMenuWidth}
      menuBody={desynced && <DesyncedFilterMessage />}
      menuFooterMessage={footerMessage}
      trigger={
        trigger ??
        ((tp, isOpen) => (
          <EnvironmentPageFilterTrigger
            {...tp}
            {...triggerProps}
            isOpen={isOpen}
            size={selectProps.size}
            value={value}
            environments={environments}
            ready={projectsLoaded && pageFilterIsReady}
            desynced={desynced}
          />
        ))
      }
    />
  );
}
