import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {LinkButton} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {updateProjects} from 'sentry/components/pageFilters/actions';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {
  HybridFilterProps,
  HybridFilterRef,
} from 'sentry/components/pageFilters/hybridFilter';
import {HybridFilter} from 'sentry/components/pageFilters/hybridFilter';
import {ProjectPageFilterTrigger} from 'sentry/components/pageFilters/project/projectPageFilterTrigger';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import {IconAdd, IconOpen, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useUser} from 'sentry/utils/useUser';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

export interface ProjectPageFilterProps extends Partial<
  Omit<
    HybridFilterProps<number>,
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
    | 'shouldCloseOnInteractOutside'
    | 'sizeLimitMessage'
  >
> {
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
  /**
   * Optional prefix for the storage key, for areas of the app that need separate pagefilters (i.e Insights)
   * TODO: ideally this can be determined by what's set in the PageFiltersContainer
   */
  storageNamespace?: string;
}

/**
 * Maximum number of projects that can be selected at a time (due to server limits). This
 * does not apply to special values like "My Projects" and "All Projects".
 */
const SELECTION_COUNT_LIMIT = 50;

export function ProjectPageFilter({
  onChange,
  onReset,
  disabled,
  sizeLimit,
  emptyMessage,
  menuTitle,
  menuWidth,
  trigger,
  resetParamsOnChange,
  storageNamespace,
  ...selectProps
}: ProjectPageFilterProps) {
  const user = useUser();
  const router = useRouter();
  const routes = useRoutes();
  const organization = useOrganization();
  const hybridFilterRef = useRef<HybridFilterRef<number>>(null);

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  // Track optimistically bookmarked projects to prevent star from disappearing
  // during API call when user bookmarks and quickly moves focus
  const [optimisticallyBookmarkedProjects, setOptimisticallyBookmarkedProjects] =
    useState<Set<string>>(
      () => new Set(projects.filter(p => p.isBookmarked).map(p => p.id))
    );
  const [memberProjects, otherProjects] = useMemo(
    () => partition(projects, project => project.isMember),
    [projects]
  );

  const showNonMemberProjects = useMemo(() => {
    const isOrgAdminOrManager =
      organization.orgRole === 'owner' || organization.orgRole === 'manager';
    const isOpenMembership = organization.features.includes('open-membership');

    return user.isSuperuser || isOrgAdminOrManager || isOpenMembership;
  }, [user, organization.orgRole, organization.features]);

  const nonMemberProjects = useMemo(
    () => (showNonMemberProjects ? otherProjects : []),
    [otherProjects, showNonMemberProjects]
  );

  const {
    selection: {projects: pageFilterValue},
    isReady: pageFilterIsReady,
  } = usePageFilters();

  /**
   * Transforms a plain array of project IDs into values that can be used as page filter
   * URL parameters. This is necessary because some configurations have special URL
   * values: "My Projects" = [] and "All Projects" = [-1].
   */
  const mapNormalValueToURLValue = useCallback(
    (val: number[]) => {
      const memberProjectsSelected = memberProjects.every(p =>
        val.includes(parseInt(p.id, 10))
      );

      // "All Projects"
      if (!val.length) {
        return [ALL_ACCESS_PROJECTS];
      }

      // "My Projects"
      if (
        showNonMemberProjects &&
        memberProjectsSelected &&
        val.length === memberProjects.length
      ) {
        return [];
      }

      return val;
    },
    [memberProjects, showNonMemberProjects]
  );

  /**
   * Transforms an array of page filter URL parameters into a plain array of project
   * IDs. This is necessary because some URL values denote special configurations: [] =
   * "My Projects" and [-1] = "All Projects".
   */
  const mapURLValueToNormalValue = useCallback(
    (val: number[]) => {
      // "All Projects"
      if (val.includes(ALL_ACCESS_PROJECTS)) {
        return [];
      }

      // "My Projects"
      if (!val.length) {
        return memberProjects.map(p => parseInt(p.id, 10));
      }

      return val;
    },
    [memberProjects]
  );

  const value = useMemo<number[]>(
    () => mapURLValueToNormalValue(pageFilterValue),
    [mapURLValueToNormalValue, pageFilterValue]
  );

  const defaultValue = useMemo<number[]>(
    () => mapURLValueToNormalValue([]),
    [mapURLValueToNormalValue]
  );

  const handleChange = useCallback(
    async (newValue: number[]) => {
      if (isEqual(newValue, value)) {
        return;
      }

      onChange?.(newValue);

      trackAnalytics('projectselector.update', {
        count: newValue.length,
        path: getRouteStringFromRoutes(routes),
        organization,
        multi: true,
      });

      // Wait for the menu to close before calling onChange
      await new Promise(resolve => setTimeout(resolve, 0));

      updateProjects(mapNormalValueToURLValue(newValue), router, {
        save: true,
        resetParams: resetParamsOnChange,
        environments: [], // Clear environments when switching projects
        storageNamespace,
      });
    },
    [
      value,
      resetParamsOnChange,
      router,
      organization,
      routes,
      onChange,
      mapNormalValueToURLValue,
      storageNamespace,
    ]
  );

  const onToggle = useCallback(
    (newValue: any) => {
      trackAnalytics('projectselector.toggle', {
        action: newValue.length > value.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(routes),
        organization,
      });
    },
    [value, routes, organization]
  );

  const onReplace = useCallback(() => {
    trackAnalytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [routes, organization]);

  const handleReset = useCallback(() => {
    onReset?.();
    trackAnalytics('projectselector.clear', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [onReset, routes, organization]);

  const options = useMemo<Array<SelectOptionOrSection<number>>>(() => {
    const hasProjects = !!memberProjects.length || !!nonMemberProjects.length;
    if (!hasProjects) {
      return [];
    }

    const getProjectItem = (project: Project) => {
      return {
        value: parseInt(project.id, 10),
        textValue: project.slug,
        leadingItems: ({isSelected}) => (
          <Checkbox
            size="sm"
            checked={isSelected}
            onChange={() =>
              hybridFilterRef.current?.toggleOption?.(parseInt(project.id, 10))
            }
            aria-label={t('Select %s', project.slug)}
            tabIndex={-1}
          />
        ),
        label: (
          <Flex align="center" gap="sm">
            <ProjectBadge project={project} avatarSize={16} hideName disableLink />
            <Text ellipsis>{project.slug}</Text>
          </Flex>
        ),
        trailingItems: (props: {isFocused: boolean}) => {
          return (
            <Flex align="center">
              {props.isFocused ? (
                <Fragment>
                  <LinkButton
                    size="xs"
                    priority="transparent"
                    icon={<IconOpen variant="muted" />}
                    aria-label={t('Open Project Details')}
                    tooltipProps={{title: t('Open Project Details'), delay: 400}}
                    to={
                      makeProjectsPathname({
                        path: `/${project.slug}/`,
                        organization,
                      }) + `?project=${project.id}`
                    }
                  />
                  <LinkButton
                    size="xs"
                    priority="transparent"
                    icon={<IconSettings variant="muted" />}
                    tooltipProps={{title: t('Open Project Settings'), delay: 400}}
                    aria-label={t('Open Project Settings')}
                    to={`/settings/${organization.slug}/projects/${project.slug}/`}
                  />
                </Fragment>
              ) : null}
              {props.isFocused || optimisticallyBookmarkedProjects.has(project.id) ? (
                <BookmarkStar
                  size="xs"
                  project={project}
                  organization={organization}
                  tooltipProps={{delay: 400}}
                  onToggle={(isBookmarked: boolean) => {
                    // Update optimistic state immediately
                    setOptimisticallyBookmarkedProjects(prev => {
                      const next = new Set(prev);
                      if (isBookmarked) {
                        next.add(project.id);
                      } else {
                        next.delete(project.id);
                      }
                      return next;
                    });
                    trackAnalytics('projectselector.bookmark_toggle', {
                      bookmarked: isBookmarked,
                      organization,
                    });
                  }}
                />
              ) : null}
            </Flex>
          );
        },
      } satisfies SelectOptionOrSection<number>;
    };

    const lastSelected = mapURLValueToNormalValue(pageFilterValue);
    const listSort = (project: Project) => [
      !lastSelected.includes(parseInt(project.id, 10)),
      !project.isBookmarked,
      project.slug,
    ];

    return nonMemberProjects.length > 0
      ? [
          {
            key: 'my-projects',
            label: t('My Projects'),
            options: sortBy(memberProjects, listSort).map(getProjectItem),
            showToggleAllButton: true,
          },
          {
            key: 'no-membership-header',
            label:
              memberProjects.length > 0 ? t('Other') : t("Projects I Don't Belong To"),
            options: sortBy(nonMemberProjects, listSort).map(getProjectItem),
          },
        ]
      : sortBy(memberProjects, listSort).map(getProjectItem);
  }, [
    organization,
    memberProjects,
    nonMemberProjects,
    mapURLValueToNormalValue,
    optimisticallyBookmarkedProjects,
    pageFilterValue,
  ]);

  const defaultMenuWidth = useMemo(() => {
    const flatOptions: Array<SelectOption<number>> = options.flatMap(item =>
      'options' in item ? item.options : [item]
    );

    // ProjectPageFilter will try to expand to accommodate the longest project slug
    const longestSlugLength = flatOptions.slice(0, 25).reduce((acc, cur) => {
      const length = cur.textValue?.length ?? 0;
      return length > acc ? length : acc;
    }, 0);

    // Calculate an appropriate width for the menu. It should be between 22  and 28em.
    // Within that range, the width is a function of the length of the longest slug.
    // The project slugs take up to (longestSlugLength * 0.6)em of horizontal space
    // (each character occupies roughly 0.6em).
    // We also need to add 12em to account for padding, trailing buttons, and the checkbox.
    const minWidthEm = 22;
    return `${Math.max(minWidthEm, Math.min(28, longestSlugLength * 0.6 + 12))}em`;
  }, [options]);

  const [stagedValue, setStagedValue] = useState<number[]>(value);
  const selectionLimitExceeded = useMemo(() => {
    const mappedValue = mapNormalValueToURLValue(stagedValue);
    return mappedValue.length > SELECTION_COUNT_LIMIT;
  }, [stagedValue, mapNormalValueToURLValue]);

  const menuFooterMessage = useMemo(() => {
    if (selectionLimitExceeded) {
      return (hasStagedChanges: any) =>
        hasStagedChanges
          ? tct(
              'Only up to [limit] projects can be selected at a time. You can still press “Clear” to see all projects.',
              {limit: SELECTION_COUNT_LIMIT}
            )
          : undefined;
    }

    return undefined;
  }, [selectionLimitExceeded]);

  const hasProjectWrite = organization.access.includes('project:write');

  return (
    <HybridFilter
      ref={hybridFilterRef}
      {...selectProps}
      searchable
      multiple
      options={options}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      onStagedValueChange={setStagedValue}
      onReset={handleReset}
      onReplace={onReplace}
      onToggle={onToggle}
      disabled={disabled ?? (!projectsLoaded || !pageFilterIsReady)}
      disableCommit={selectionLimitExceeded}
      sizeLimit={sizeLimit ?? 25}
      emptyMessage={emptyMessage ?? t('No projects found')}
      menuTitle={menuTitle ?? t('Filter Projects')}
      menuWidth={menuWidth ?? defaultMenuWidth}
      menuFooter={
        hasProjectWrite ? (
          <LinkButton
            size="xs"
            aria-label={t('Create Project')}
            to={makeProjectsPathname({path: '/new/', organization})}
            icon={<IconAdd />}
          >
            {t('Create Project')}
          </LinkButton>
        ) : undefined
      }
      menuFooterMessage={menuFooterMessage}
      trigger={
        trigger ??
        (triggerProps => (
          <ProjectPageFilterTrigger
            {...triggerProps}
            value={value}
            memberProjects={memberProjects}
            nonMemberProjects={nonMemberProjects}
            ready={projectsLoaded && pageFilterIsReady}
          />
        ))
      }
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
    />
  );
}

function shouldCloseOnInteractOutside(target: Element) {
  // Don't close select menu when clicking on power hovercard ("Requires Business Plan") or disabled feature hovercard
  const powerHovercard = target.closest('[data-test-id="power-hovercard"]');
  const disabledFeatureHovercard = target.closest(
    '[data-test-id="disabled-feature-hovercard"]'
  );
  return !powerHovercard && !disabledFeatureHovercard;
}
