import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import Badge from 'sentry/components/badge';
import {MultipleSelectProps} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {analytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {trimSlug} from 'sentry/utils/trimSlug';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

import {HybridFilter} from './hybridFilter';

export interface EnvironmentPageFilterProps {
  /**
   * Message to show in the menu footer
   */
  footerMessage?: string;
  /**
   * Triggers any time a selection is changed, but the menu has not yet been closed or "applied"
   */
  onChange?: (selected: string[]) => void;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function EnvironmentPageFilter({
  onChange,
  resetParamsOnChange,
  footerMessage,
  ...selectProps
}: EnvironmentPageFilterProps) {
  const router = useRouter();
  const organization = useOrganization();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const {
    selection: {projects: projectPageFilterValue, environments: envPageFilterValue},
    isReady: pageFilterIsReady,
  } = usePageFilters();

  const environments = useMemo(() => {
    const {user} = ConfigStore.getState();

    const unsortedEnvironments = projects.flatMap(project => {
      const projectId = parseInt(project.id, 10);
      // Include environments from:
      // - all projects if the user is a superuser
      // - the requested projects
      // - all member projects if 'my projects' (empty list) is selected.
      // - all projects if -1 is the only selected project.
      if (
        (projectPageFilterValue.includes(ALL_ACCESS_PROJECTS) && project.hasAccess) ||
        (projectPageFilterValue.length === 0 && (project.isMember || user.isSuperuser)) ||
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
      onChange?.(newValue);

      analytics('environmentselector.update', {
        count: newValue.length,
        path: getRouteStringFromRoutes(router.routes),
        org_id: parseInt(organization.id, 10),
      });

      // Wait for the menu to close before calling onChange
      await new Promise(resolve => setTimeout(resolve, 0));

      updateEnvironments(newValue, router, {
        save: true,
        resetParams: resetParamsOnChange,
      });
    },
    [resetParamsOnChange, router, organization, onChange]
  );

  const onToggle = useCallback(
    newValue => {
      analytics('environmentselector.toggle', {
        action: newValue.length > value.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(router.routes),
        org_id: parseInt(organization.id, 10),
      });
    },
    [value, router.routes, organization]
  );

  const onReplace = useCallback(() => {
    analytics('environmentselector.direct_selection', {
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
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

  const trigger = useCallback<NonNullable<MultipleSelectProps<number>['trigger']>>(
    props => {
      const isAllEnvironmentsSelected =
        value.length === 0 || environments.every(env => value.includes(env));

      // Show 2 environments only if the combined string's length does not exceed 25.
      // Otherwise show only 1 environment.
      const envsToShow =
        value[0]?.length + value[1]?.length <= 23 ? value.slice(0, 2) : value.slice(0, 1);

      const label = isAllEnvironmentsSelected
        ? t('All Envs')
        : envsToShow.map(env => trimSlug(env, 25)).join(', ');

      // Number of environments that aren't listed in the trigger label
      const remainingCount = isAllEnvironmentsSelected
        ? 0
        : value.length - envsToShow.length;

      return (
        <DropdownButton {...props} icon={<IconWindow />}>
          <TriggerLabel>
            {!projectsLoaded || !pageFilterIsReady ? t('Loading\u2026') : label}
          </TriggerLabel>
          {remainingCount > 0 && <StyledBadge text={`+${remainingCount}`} />}
        </DropdownButton>
      );
    },
    [environments, value, pageFilterIsReady, projectsLoaded]
  );

  const menuWidth = useMemo(() => {
    const longestSlug = options
      .slice(0, 25)
      .reduce(
        (acc, cur) => (String(cur.label).length > acc ? String(cur.label).length : acc),
        0
      );

    return `${Math.max(16, Math.min(24, 6 + longestSlug * 0.6))}em`;
  }, [options]);

  return (
    <HybridFilter
      {...selectProps}
      searchable
      multiple
      trigger={trigger}
      options={options}
      value={value}
      onChange={handleChange}
      onReplace={onReplace}
      onToggle={onToggle}
      disabled={!projectsLoaded || !pageFilterIsReady}
      sizeLimit={25}
      sizeLimitMessage={t('Use search to find more environments…')}
      emptyMessage={t('No environments found')}
      menuTitle={t('Filter Environments')}
      menuWidth={menuWidth}
      menuFooterMessage={footerMessage}
    />
  );
}

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
