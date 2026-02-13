import {useCallback, useMemo, useRef} from 'react';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import {Checkbox} from '@sentry/scraps/checkbox';

import {updateEnvironments} from 'sentry/components/pageFilters/actions';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {
  EnvironmentPageFilterTrigger,
  type EnvironmentPageFilterTriggerProps,
} from 'sentry/components/pageFilters/environment/environmentPageFilterTrigger';
import type {HybridFilterProps} from 'sentry/components/pageFilters/hybridFilter';
import {
  HybridFilter,
  type HybridFilterRef,
} from 'sentry/components/pageFilters/hybridFilter';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

export interface EnvironmentPageFilterProps extends Partial<
  Omit<
    HybridFilterProps<string>,
    | 'searchable'
    | 'multiple'
    | 'options'
    | 'value'
    | 'defaultValue'
    | 'onReplace'
    | 'onToggle'
    | 'menuTitle'
    | 'menuBody'
    | 'menuFooter'
    | 'menuFooterMessage'
    | 'shouldCloseOnInteractOutside'
    | 'triggerProps'
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
  triggerProps?: Partial<EnvironmentPageFilterTriggerProps>;
}

export function EnvironmentPageFilter({
  onChange,
  onReset,
  disabled,
  sizeLimit,
  sizeLimitMessage,
  emptyMessage,
  menuWidth,
  trigger,
  resetParamsOnChange,
  footerMessage,
  triggerProps = {},
  storageNamespace,
  ...selectProps
}: EnvironmentPageFilterProps) {
  const router = useRouter();
  const organization = useOrganization();
  const hybridFilterRef = useRef<HybridFilterRef<string>>(null);

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const {
    selection: {projects: projectPageFilterValue, environments: envPageFilterValue},
    isReady: pageFilterIsReady,
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
        storageNamespace,
      });
    },
    [
      envPageFilterValue,
      resetParamsOnChange,
      router,
      organization,
      onChange,
      storageNamespace,
    ]
  );

  const onToggle = useCallback(
    (newValue: any) => {
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
        leadingItems: ({isSelected}: {isSelected: boolean}) => (
          <Checkbox
            size="sm"
            checked={isSelected}
            onChange={() => hybridFilterRef.current?.toggleOption?.(env)}
            aria-label={t('Select %s', env)}
            tabIndex={-1}
          />
        ),
      })),
    [environments]
  );

  const defaultMenuWidth = useMemo(() => {
    // EnvironmentPageFilter will try to expand to accommodate the longest env slug
    const longestSlugLength = options
      .slice(0, 25)
      .reduce(
        (acc, cur) => (String(cur.label).length > acc ? String(cur.label).length : acc),
        0
      );

    // Calculate an appropriate width for the menu. It should be between 16 and 24em.
    // Within that range, the width is a function of the length of the longest slug.
    // The environment slugs take up to (longestSlugLength * 0.6)em of horizontal space
    // (each character occupies roughly 0.6em). We also need to add 6em to account for
    // the checkbox and menu paddings.
    return `${Math.max(16, Math.min(24, longestSlugLength * 0.6 + 6))}em`;
  }, [options]);

  return (
    <HybridFilter
      {...selectProps}
      ref={hybridFilterRef}
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
      menuTitle={t('Filter Environments')}
      menuWidth={menuWidth ?? defaultMenuWidth}
      menuFooterMessage={footerMessage}
      trigger={
        trigger ??
        (tp => (
          <EnvironmentPageFilterTrigger
            {...tp}
            {...triggerProps}
            value={value}
            environments={environments}
            ready={projectsLoaded && pageFilterIsReady}
          />
        ))
      }
    />
  );
}
