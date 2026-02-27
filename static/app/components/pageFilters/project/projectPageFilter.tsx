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
type SentinelMode = 'all' | 'my';

interface SentinelSelectionState {
  isAllProjectsMode: boolean;
  isMyProjectsMode: boolean;
  stagedSentinelMode: SentinelMode | null;
}

type SentinelTransition =
  | {stagedValue: number[]; suppressed: {type: 'add'; modes: SentinelMode[]}}
  | {stagedValue: number[]; suppressed: {type: 'clear'}};

function projectId(project: Pick<Project, 'id'>): number {
  return parseInt(project.id, 10);
}

function applySuppressedModesTransition(
  prev: Set<SentinelMode>,
  transition: SentinelTransition
): Set<SentinelMode> {
  if (transition.suppressed.type === 'clear') {
    return new Set();
  }
  return new Set([...prev, ...transition.suppressed.modes]);
}

function isProjectCheckedInMode({
  isSelected,
  isMember,
  noStagedChanges,
  allProjectsSentinelStaged,
  myProjectsSentinelStaged,
  isAllProjectsMode,
  isMyProjectsMode,
}: {
  isSelected: boolean;
  isMember: boolean;
  noStagedChanges: boolean;
  allProjectsSentinelStaged: boolean;
  myProjectsSentinelStaged: boolean;
  isAllProjectsMode: boolean;
  isMyProjectsMode: boolean;
}): boolean {
  if (allProjectsSentinelStaged) {
    return true;
  }

  if (myProjectsSentinelStaged && isMember) {
    return true;
  }

  if (noStagedChanges && isAllProjectsMode) {
    return true;
  }

  if (noStagedChanges && isMyProjectsMode && isMember) {
    return true;
  }

  return isSelected;
}

function getSentinelSelectionState({
  pageFilterValue,
  stagedValue,
  suppressedCommittedModes,
}: {
  pageFilterValue: number[];
  stagedValue: number[];
  suppressedCommittedModes: Set<SentinelMode>;
}): SentinelSelectionState {
  const stagedSentinelMode: SentinelMode | null = stagedValue.includes(ALL_ACCESS_PROJECTS)
    ? 'all'
    : stagedValue.includes(MY_PROJECTS_VALUE)
      ? 'my'
      : null;
  const anySentinelStaged = stagedSentinelMode !== null;
  const committedAllProjectsMode = pageFilterValue.includes(ALL_ACCESS_PROJECTS);
  const committedMyProjectsMode = pageFilterValue.length === 0;
  const isAllProjectsMode =
    stagedSentinelMode === 'all' ||
    (!suppressedCommittedModes.has('all') &&
      !anySentinelStaged &&
      committedAllProjectsMode);
  const isMyProjectsMode =
    isAllProjectsMode ||
    stagedSentinelMode === 'my' ||
    (!suppressedCommittedModes.has('my') &&
      !anySentinelStaged &&
      committedMyProjectsMode);

  return {stagedSentinelMode, isAllProjectsMode, isMyProjectsMode};
}

function getAllProjectsToggleTransition(isAllProjectsMode: boolean): SentinelTransition {
  if (isAllProjectsMode) {
    return {
      stagedValue: [],
      suppressed: {type: 'add', modes: ['all']},
    };
  }

  return {
    stagedValue: [ALL_ACCESS_PROJECTS],
    suppressed: {type: 'clear'},
  };
}

function getMyProjectsToggleTransition({
  isAllProjectsMode,
  isMyProjectsMode,
  stagedSentinelMode,
  nonMemberProjectIds,
}: {
  isAllProjectsMode: boolean;
  isMyProjectsMode: boolean;
  stagedSentinelMode: SentinelMode | null;
  nonMemberProjectIds: number[];
}): SentinelTransition {
  if (isAllProjectsMode) {
    return {
      stagedValue: nonMemberProjectIds,
      suppressed: {type: 'add', modes: ['all', 'my']},
    };
  }

  if (stagedSentinelMode === 'my' || isMyProjectsMode) {
    return {
      // Toggling off "My Projects" from a My-only state should leave nothing selected.
      stagedValue: [],
      suppressed: {type: 'add', modes: ['all', 'my']},
    };
  }

  return {
    stagedValue: [MY_PROJECTS_VALUE],
    suppressed: {type: 'clear'},
  };
}

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

  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);

  // Tracks committed sentinel modes that have been explicitly toggled off while the menu
  // is open. This prevents committed URL fallback ("All Projects"/"My Projects")
  // from immediately re-checking those sentinels before Apply.
  const [suppressedCommittedModes, setSuppressedCommittedModes] = useState<Set<SentinelMode>>(
    () => new Set()
  );

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
  const nonMemberProjectIds = useMemo(
    () => nonMemberProjects.map(projectId),
    [nonMemberProjects]
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
    const {stagedSentinelMode, isAllProjectsMode, isMyProjectsMode} =
      getSentinelSelectionState({
        pageFilterValue,
        stagedValue,
        suppressedCommittedModes,
      });
    const allProjectsSentinelStaged = stagedSentinelMode === 'all';
    const myProjectsSentinelStaged = stagedSentinelMode === 'my';
    // When staged is empty, there are no pending changes — use the URL mode flags as
    // a fallback so individual project checkboxes reflect the committed mode (All/My
    // Projects). When staged is non-empty the per-item isSelected and the sentinel-
    // staged flags take over.
    const noStagedChanges = stagedValue.length === 0;

    const setStaged = (nextValue: number[]) => {
      dispatchRef.current?.({type: 'set staged', value: nextValue});
    };

    const applySentinelTransition = (transition: SentinelTransition) => {
      setStaged(transition.stagedValue);
      setSuppressedCommittedModes(prev =>
        applySuppressedModesTransition(prev, transition)
      );
    };

    const handleAllProjectsToggle = () => {
      applySentinelTransition(getAllProjectsToggleTransition(isAllProjectsMode));
    };

    const handleMyProjectsToggle = () => {
      applySentinelTransition(
        getMyProjectsToggleTransition({
          isAllProjectsMode,
          isMyProjectsMode,
          stagedSentinelMode,
          nonMemberProjectIds,
        })
      );
    };

    const getProjectItem = (project: Project) => {
      return {
        value: projectId(project),
        textValue: project.slug,
        leadingItems: ({isSelected}) => (
          <MenuComponents.Checkbox
            checked={isProjectCheckedInMode({
              isSelected,
              isMember: project.isMember,
              noStagedChanges,
              allProjectsSentinelStaged,
              myProjectsSentinelStaged,
              isAllProjectsMode,
              isMyProjectsMode,
            })}
            onChange={() => toggleOptionRef.current?.(projectId(project))}
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
                    onChange={handleAllProjectsToggle}
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
                    onChange={handleMyProjectsToggle}
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
            !lastSelected.includes(projectId(project)),
            !project.isMember,
            !bookmarkedSnapshotRef.current.has(project.id),
            project.slug,
          ]
        : [
            !lastSelected.includes(projectId(project)),
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
    nonMemberProjectIds,
    optimisticallyBookmarkedProjects,
    pageFilterValue,
    stagedValue,
    suppressedCommittedModes,
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

  // True when the user has explicitly deselected "My Projects" from a My-Projects URL
  // state but hasn't selected anything else. In this state we suppress the Apply button
  // and revert on close, mirroring the "All Projects deselected" behavior. Without this
  // guard, clicking Apply (or interact-outside) would commit [] → mapNormalValueToURLValue([])
  // = [-1], silently switching the URL from My Projects to All Projects.
  const isMyProjectsDeselectedOnly =
    stagedSelect.value.length === 0 &&
    suppressedCommittedModes.has('my') &&
    pageFilterValue.length === 0;

  // Merge the hook's onOpenChange (resets shift-click anchor) with the local
  // snapshot logic (freezes the bookmark sort order while the menu is open).
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        bookmarkedSnapshotRef.current = new Set(optimisticallyBookmarkedProjects);
        dispatch({type: 'reset anchor'});
        setSuppressedCommittedModes(new Set());
      }
    },
    [dispatch, optimisticallyBookmarkedProjects]
  );

  const handleReset = useCallback(() => {
    dispatch({type: 'remove staged'});
    setSuppressedCommittedModes(new Set());
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
    setSuppressedCommittedModes(new Set());
  }, [dispatch, routes, organization]);

  // Revert staged changes without committing. Used when My Projects is deselected only —
  // clicking outside should not commit [] → All Projects URL.
  const handleRevertOnClose = useCallback(() => {
    dispatch({type: 'remove staged'});
    setSuppressedCommittedModes(new Set());
  }, [dispatch]);

  const handleApply = useCallback(() => {
    trackAnalytics('projectselector.apply', {
      count: stagedValue.length,
      multi: stagedValue.length > 1,
      path: getRouteStringFromRoutes(routes),
      organization,
    });
    dispatch({type: 'remove staged'});
    setSuppressedCommittedModes(new Set());
    handleChange(stagedSelect.value);
  }, [dispatch, handleChange, routes, organization, stagedSelect.value, stagedValue]);

  const hasStagedChanges =
    !isMyProjectsDeselectedOnly && xor(stagedSelect.value, value).length > 0;
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
      onInteractOutside={
        isMyProjectsDeselectedOnly
          ? handleRevertOnClose
          : stagedSelect.compactSelectProps.onInteractOutside
      }
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
                  `You've selected [count] projects, but only up to [limit] can be selected at a time. Select All Projects to view all projects.`,
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
