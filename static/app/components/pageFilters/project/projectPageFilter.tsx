import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {isAppleDevice} from '@react-aria/utils';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import xor from 'lodash/xor';

import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import type {MultipleSelectProps, SelectOption} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {updateProjects} from 'sentry/components/pageFilters/actions';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {ProjectPageFilterTrigger} from 'sentry/components/pageFilters/project/projectPageFilterTrigger';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import {
  IconAdd,
  IconAllProjects,
  IconMyProjects,
  IconOpen,
  IconSettings,
} from 'sentry/icons';
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
  Omit<MultipleSelectProps<number>, 'onChange'>
> {
  /**
   * Called when the selection changes
   */
  onChange?: (selected: number[]) => void;
  /**
   * Called when the reset button is clicked
   */
  onReset?: () => void;
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

/**
 * Sentinel value for the "My Projects" quick-select option. Must be negative to avoid
 * collision with real project IDs. ALL_ACCESS_PROJECTS (-1) is already used for
 * "All Projects".
 */
const MY_PROJECTS_VALUE = -2;

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

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  // Ref to break the circular dependency: options need toggleOption/dispatch, but those
  // come from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: number) => void) | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);

  // Tracks which sentinel modes the user has explicitly clicked to deselect while they
  // were already active from the committed URL. Without this, isAllProjectsMode /
  // isMyProjectsMode would stay true (from the committed URL fallback) even after the
  // user clicks to uncheck them. Reset when the menu reopens.
  const [deselectedModes, setDeselectedModes] = useState(() => new Set<number>());

  // Track optimistically bookmarked projects to prevent star from disappearing
  // during API call when user bookmarks and quickly moves focus
  const [optimisticallyBookmarkedProjects, setOptimisticallyBookmarkedProjects] =
    useState<Set<string>>(
      () => new Set(projects.filter(p => p.isBookmarked).map(p => p.id))
    );

  // Snapshot of bookmarked projects when menu opens - used for sorting to prevent
  // re-sorting while menu is open
  const bookmarkedSnapshotRef = useRef<Set<string> | undefined>(undefined);

  if (!bookmarkedSnapshotRef.current) {
    bookmarkedSnapshotRef.current = new Set(optimisticallyBookmarkedProjects);
  }

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
      if (val.includes(ALL_ACCESS_PROJECTS)) {
        return [ALL_ACCESS_PROJECTS];
      }

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

  const [stagedValue, setStagedValue] = useState<number[]>(value);

  const handleChange = useCallback(
    async (newValue: number[]) => {
      // Translate sentinel values to their actual project ID lists
      let resolvedValue = newValue;
      if (newValue.includes(ALL_ACCESS_PROJECTS)) {
        resolvedValue = [];
      } else if (newValue.includes(MY_PROJECTS_VALUE)) {
        resolvedValue = defaultValue;
      }

      onChange?.(resolvedValue);

      trackAnalytics('projectselector.update', {
        count: resolvedValue.length,
        path: getRouteStringFromRoutes(routes),
        organization,
        multi: resolvedValue.length > 1,
      });

      // Wait for the menu to close before calling onChange
      await new Promise(resolve => setTimeout(resolve, 0));

      updateProjects(mapNormalValueToURLValue(resolvedValue), router, {
        save: true,
        resetParams: resetParamsOnChange,
        environments: [], // Clear environments when switching projects
        storageNamespace,
      });
    },
    [
      defaultValue,
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
    (newValue: number[]) => {
      trackAnalytics('projectselector.toggle', {
        action: newValue.length > stagedValue.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(routes),
        organization,
      });
    },
    [stagedValue, routes, organization]
  );

  const onReplace = useCallback(() => {
    trackAnalytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [routes, organization]);

  const options = useMemo<Array<SelectOption<number>>>(() => {
    // A sentinel may be staged but not yet committed to the URL. Check staged first,
    // then fall back to the committed page filter value (unless the user has explicitly
    // clicked to deselect that mode, tracked by deselectedModes).
    const allProjectsSentinelStaged = stagedValue.includes(ALL_ACCESS_PROJECTS);
    const myProjectsSentinelStaged = stagedValue.includes(MY_PROJECTS_VALUE);
    const anySentinelStaged = allProjectsSentinelStaged || myProjectsSentinelStaged;
    const isAllProjectsMode =
      allProjectsSentinelStaged ||
      (!deselectedModes.has(ALL_ACCESS_PROJECTS) &&
        !anySentinelStaged &&
        pageFilterValue.includes(ALL_ACCESS_PROJECTS));
    // My Projects is a subset of All Projects, so it's also "selected" when All Projects
    // is active. The committed URL fallback also applies unless explicitly deselected.
    const isMyProjectsMode =
      isAllProjectsMode ||
      myProjectsSentinelStaged ||
      (!deselectedModes.has(MY_PROJECTS_VALUE) &&
        !anySentinelStaged &&
        pageFilterValue.length === 0);

    const getProjectItem = (project: Project) => {
      return {
        value: parseInt(project.id, 10),
        textValue: project.slug,
        leadingItems: ({isSelected}) => (
          <MenuComponents.Checkbox
            checked={
              allProjectsSentinelStaged ||
              (myProjectsSentinelStaged && project.isMember) ||
              isSelected
            }
            onChange={() => toggleOptionRef.current?.(parseInt(project.id, 10))}
            aria-label={t('Select %s', project.slug)}
            tabIndex={-1}
          />
        ),
        label: (
          <Flex align="center" gap="sm" flex="1 1 100%">
            <ProjectBadge project={project} avatarSize={16} hideName disableLink />
            <Text ellipsis>{project.slug}</Text>
          </Flex>
        ),
        trailingItems: (props: {isFocused: boolean}) => {
          return (
            // This is nasty, but because CompactSelect's menuListItem has a padding around the entire item and a height
            // that is smaller than the height of an xs button, they end up being misaligned and we need to manually adjust them.
            <Flex align="center" style={{marginTop: '-4px'}}>
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
      } satisfies SelectOption<number>;
    };

    const specialItems: Array<SelectOption<number>> =
      nonMemberProjects.length > 0
        ? [
            {
              value: ALL_ACCESS_PROJECTS,
              label: t('All Projects'),
              textValue: '',
              leadingItems: () => (
                <Fragment>
                  <MenuComponents.Checkbox
                    checked={isAllProjectsMode}
                    onChange={() => {
                      if (isAllProjectsMode) {
                        // Deselect: clear staged and mark mode as explicitly deselected
                        dispatchRef.current?.({type: 'set staged', value: []});
                        setDeselectedModes(
                          prev => new Set([...prev, ALL_ACCESS_PROJECTS])
                        );
                      } else {
                        // Activate All Projects
                        dispatchRef.current?.({
                          type: 'set staged',
                          value: [ALL_ACCESS_PROJECTS],
                        });
                        setDeselectedModes(new Set());
                      }
                    }}
                    aria-label={t('Select All Projects')}
                    tabIndex={-1}
                  />
                  <IconAllProjects size="sm" variant="muted" />
                </Fragment>
              ),
            },
            {
              value: MY_PROJECTS_VALUE,
              label: t('My Projects'),
              textValue: '',
              leadingItems: () => (
                <Fragment>
                  <MenuComponents.Checkbox
                    checked={isMyProjectsMode}
                    onChange={() => {
                      if (
                        myProjectsSentinelStaged ||
                        (isMyProjectsMode && !isAllProjectsMode)
                      ) {
                        // Deselect My Projects (was staged or from committed URL)
                        dispatchRef.current?.({type: 'set staged', value: []});
                        setDeselectedModes(prev => new Set([...prev, MY_PROJECTS_VALUE]));
                      } else {
                        // Activate My Projects (or switch from All Projects to My Projects)
                        dispatchRef.current?.({
                          type: 'set staged',
                          value: [MY_PROJECTS_VALUE],
                        });
                        setDeselectedModes(new Set());
                      }
                    }}
                    aria-label={t('Select My Projects')}
                    tabIndex={-1}
                  />
                  <IconMyProjects size="sm" variant="muted" />
                </Fragment>
              ),
            },
          ]
        : [];

    const lastSelected = mapURLValueToNormalValue(pageFilterValue);
    const listSort = (project: Project) =>
      bookmarkedSnapshotRef.current
        ? [
            !lastSelected.includes(parseInt(project.id, 10)),
            !project.isMember,
            !bookmarkedSnapshotRef.current.has(project.id),
            project.slug,
          ]
        : [
            !lastSelected.includes(parseInt(project.id, 10)),
            !project.isMember,
            project.slug,
          ];

    return [
      ...specialItems,
      ...sortBy([...memberProjects, ...nonMemberProjects], listSort).map(getProjectItem),
    ];
  }, [
    organization,
    memberProjects,
    nonMemberProjects,
    mapURLValueToNormalValue,
    optimisticallyBookmarkedProjects,
    pageFilterValue,
    stagedValue,
    deselectedModes,
  ]);

  const defaultMenuWidth = useMemo(() => {
    // ProjectPageFilter will try to expand to accommodate the longest project slug
    const longestSlugLength = options.reduce((acc, cur) => {
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

  const selectionLimitExceeded = useMemo(() => {
    const realStagedValue = stagedValue.filter(
      v => v !== ALL_ACCESS_PROJECTS && v !== MY_PROJECTS_VALUE
    );
    const mappedValue = mapNormalValueToURLValue(realStagedValue);
    return mappedValue.length > SELECTION_COUNT_LIMIT;
  }, [stagedValue, mapNormalValueToURLValue]);

  const stagedSelect = useStagedCompactSelect({
    value,
    options,
    onChange: handleChange,
    onStagedValueChange: setStagedValue,
    onToggle,
    onReplace,
    multiple: true,
    disableCommit: selectionLimitExceeded,
  });

  // Wire up refs after stagedSelect is created to break the circular dependency between
  // options (which need toggleOption/dispatch) and useStagedCompactSelect (which needs
  // options).
  toggleOptionRef.current = stagedSelect.toggleOption;
  dispatchRef.current = stagedSelect.dispatch;

  const {dispatch} = stagedSelect;

  // Merge the hook's onOpenChange (resets shift-click anchor) with the local
  // snapshot logic (freezes the bookmark sort order while the menu is open).
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        bookmarkedSnapshotRef.current = new Set(optimisticallyBookmarkedProjects);
        dispatch({type: 'reset anchor'});
        setDeselectedModes(new Set());
      }
    },
    [dispatch, optimisticallyBookmarkedProjects]
  );

  const handleReset = useCallback(() => {
    dispatch({type: 'remove staged'});
    setDeselectedModes(new Set());
    handleChange(defaultValue);
    onReset?.();

    trackAnalytics('projectselector.clear', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [dispatch, handleChange, defaultValue, onReset, routes, organization]);

  const handleCancel = useCallback(() => {
    trackAnalytics('projectselector.cancel', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
    dispatch({type: 'remove staged'});
    setDeselectedModes(new Set());
  }, [dispatch, routes, organization]);

  const handleApply = useCallback(() => {
    trackAnalytics('projectselector.apply', {
      count: stagedValue.length,
      multi: stagedValue.length > 1,
      path: getRouteStringFromRoutes(routes),
      organization,
    });
    dispatch({type: 'remove staged'});
    setDeselectedModes(new Set());
    handleChange(stagedSelect.value);
  }, [dispatch, handleChange, routes, organization, stagedSelect.value, stagedValue]);

  const hasStagedChanges = xor(stagedSelect.value, value).length > 0;
  const shouldShowReset = xor(stagedSelect.value, defaultValue).length > 0;

  const hasProjectWrite = organization.access.includes('project:write');

  return (
    <CompactSelect
      grid
      multiple
      {...selectProps}
      {...stagedSelect.compactSelectProps}
      disabled={disabled ?? (!projectsLoaded || !pageFilterIsReady)}
      sizeLimit={sizeLimit}
      emptyMessage={emptyMessage ?? t('No projects found')}
      menuTitle={
        menuTitle ?? (
          <Flex gap="xs" align="center">
            <Text>{t('Filter Projects')}</Text>
            <InfoTip
              size="xs"
              title={tct(
                '[rangeModifier] + click to select a range of projects or [multiModifier] + click to select multiple projects at once.',
                {
                  rangeModifier: t('Shift'),
                  multiModifier: isAppleDevice() ? t('Cmd') : t('Ctrl'),
                }
              )}
            />
          </Flex>
        )
      }
      menuWidth={menuWidth ?? defaultMenuWidth}
      onOpenChange={handleOpenChange}
      menuHeaderTrailingItems={
        shouldShowReset ? <MenuComponents.ResetButton onClick={handleReset} /> : null
      }
      menuFooter={
        selectionLimitExceeded || hasProjectWrite || hasStagedChanges ? (
          <Stack gap="md" direction="column">
            {selectionLimitExceeded && (
              <MenuComponents.Alert variant="warning">
                {tct(
                  `You've selected [count] projects, but only up to [limit] can be selected at a time. Clear your selection to view all projects.`,
                  {
                    limit: SELECTION_COUNT_LIMIT,
                    count: stagedValue.length,
                  }
                )}
              </MenuComponents.Alert>
            )}
            <Flex gap="md" align="center" justify={hasProjectWrite ? 'between' : 'end'}>
              {hasProjectWrite ? (
                <MenuComponents.CTALinkButton
                  icon={<IconAdd />}
                  to={makeProjectsPathname({path: '/new/', organization})}
                  onClick={handleApply}
                >
                  {t('Create Project')}
                </MenuComponents.CTALinkButton>
              ) : undefined}
              {hasStagedChanges ? (
                <Flex gap="md" align="center" justify="end">
                  <MenuComponents.CancelButton onClick={handleCancel} />
                  <MenuComponents.ApplyButton
                    disabled={selectionLimitExceeded}
                    onClick={handleApply}
                  />
                </Flex>
              ) : null}
            </Flex>
          </Stack>
        ) : null
      }
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
