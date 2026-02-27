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
import {Separator} from '@sentry/scraps/separator';
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
  const router = useRouter();
  const routes = useRoutes();
  const organization = useOrganization();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {
    selection: {projects: pageFilterValue},
    isReady: pageFilterIsReady,
  } = usePageFilters();

  const showNonMemberProjects =
    organization.orgRole === 'owner' ||
    organization.orgRole === 'manager' ||
    organization.features.includes('open-membership');

  const [memberProjects, nonMemberProjects] = useMemo(() => {
    const partitionedProjects = partition(projects, project => project.isMember);
    if (showNonMemberProjects) {
      return [partitionedProjects[0], partitionedProjects[1]];
    }

    return [partitionedProjects[0], []];
  }, [projects, showNonMemberProjects]);

  const [value, defaultValue] = useMemo<[number[], number[]]>(
    () => [
      mapURLValueToNormalValue({
        value: pageFilterValue,
        memberProjectIds: memberProjects.map(project => parseInt(project.id, 10)),
      }),
      mapURLValueToNormalValue({
        value: [],
        memberProjectIds: memberProjects.map(project => parseInt(project.id, 10)),
      }),
    ],
    [pageFilterValue, memberProjects]
  );

  // Ref to break the circular dependency: options need toggleOption/dispatch, but those
  // come from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: number) => void) | undefined>(undefined);
  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);

  // Tracks committed sentinel modes that have been explicitly toggled off while the menu
  // is open. This prevents committed URL fallback ("All Projects"/"My Projects")
  // from immediately re-checking those sentinels before Apply.
  const [suppressedCommittedModes, setSuppressedCommittedModes] = useState<
    Set<SentinelMode>
  >(() => new Set());

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

  const [stagedValue, setStagedValue] = useState<number[]>(value);
  const [hasStagedValue, setHasStagedValue] = useState(false);

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

      updateProjects(
        mapNormalValueToURLValue({
          value: resolvedValue,
          memberProjectIds: memberProjects.map(project => parseInt(project.id, 10)),
          showNonMemberProjects,
        }),
        router,
        {
          save: true,
          resetParams: resetParamsOnChange,
          environments: [], // Clear environments when switching projects
          storageNamespace,
        }
      );
    },
    [
      defaultValue,
      memberProjects,
      showNonMemberProjects,
      resetParamsOnChange,
      router,
      organization,
      routes,
      onChange,
      storageNamespace,
    ]
  );

  const options = useMemo<Array<SelectOption<number>>>(() => {
    const {stagedSentinelMode, isAllProjectsMode, isMyProjectsMode} =
      getSentinelSelectionState({
        pageFilterValue,
        stagedValue,
        suppressedCommittedModes,
        hasStagedValue,
      });
    const allProjectsSentinelStaged = stagedSentinelMode === 'all';
    const myProjectsSentinelStaged = stagedSentinelMode === 'my';
    // When there is no staged state, use URL mode fallback so checkboxes reflect
    // committed All/My Projects modes. If staged state exists (even empty []), do not
    // fall back to committed URL modes.
    const noStagedChanges = !hasStagedValue;
    const setStaged = (nextValue: number[]) => {
      dispatchRef.current?.({type: 'set staged', value: nextValue});
    };

    const handleAllProjectsToggle = () => {
      const transition = isAllProjectsMode
        ? {
            stagedValue: [],
            suppressed: {type: 'add', modes: ['all']},
          }
        : {
            stagedValue: [ALL_ACCESS_PROJECTS],
            suppressed: {type: 'clear'},
          };

      setStaged(transition.stagedValue);
      setSuppressedCommittedModes(prev => {
        if (transition.suppressed.type === 'clear') {
          return new Set();
        }
        return new Set([...prev, ...transition.suppressed.modes]);
      });
    };

    const handleMyProjectsToggle = () => {
      const transition = getMyProjectsToggleTransition({
        isAllProjectsMode,
        isMyProjectsMode,
        stagedSentinelMode,
        nonMemberProjectIds: nonMemberProjects.map(project => parseInt(project.id, 10)),
      });
      setStaged(transition.stagedValue);
      setSuppressedCommittedModes(prev => {
        if (transition.suppressed.type === 'clear') {
          return new Set();
        }
        return new Set([...prev, ...transition.suppressed.modes]);
      });
    };

    const allProjectIds = [
      ...memberProjects.map(project => parseInt(project.id, 10)),
      ...nonMemberProjects.map(project => parseInt(project.id, 10)),
    ];

    const handleProjectToggle = (project: Project) => {
      const clickedProjectId = parseInt(project.id, 10);

      const fallbackSelection =
        !allProjectsSentinelStaged && !myProjectsSentinelStaged
          ? hasStagedValue
            ? null
            : isAllProjectsMode
              ? allProjectIds
              : isMyProjectsMode && project.isMember
                ? memberProjects.map(p => parseInt(project.id, 10))
                : null
          : null;

      // In committed fallback modes (All/My), seed staged state from the effective
      // committed selection before toggling the clicked project.
      if (fallbackSelection) {
        setStaged(fallbackSelection.filter(id => id !== clickedProjectId));
        setSuppressedCommittedModes(
          prev =>
            new Set([
              ...prev,
              ...(isAllProjectsMode ? (['all', 'my'] as const) : (['my'] as const)),
            ])
        );
        return;
      }

      toggleOptionRef.current?.(clickedProjectId);
    };

    const getProjectItem = (project: Project) => {
      return {
        value: parseInt(project.id, 10),
        textValue: project.slug,
        leadingItems: ({isSelected}) => (
          <MenuComponents.Checkbox
            checked={
              allProjectsSentinelStaged
                ? true
                : myProjectsSentinelStaged && project.isMember
                  ? true
                  : noStagedChanges && isAllProjectsMode
                    ? true
                    : noStagedChanges && isMyProjectsMode && project.isMember
                      ? true
                      : isSelected
            }
            onChange={() => handleProjectToggle(project)}
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

    const specialItems = [
      ...(nonMemberProjects.length > 0
        ? [
            {
              value: ALL_ACCESS_PROJECTS,
              label: (
                <Flex
                  align="center"
                  justify="between"
                  width="100%"
                  style={
                    memberProjects.length + nonMemberProjects.length > 0
                      ? {position: 'relative'}
                      : undefined
                  }
                >
                  <Text>{t('All Projects')}</Text>
                  <Text size="sm" variant="muted">
                    ({projects.length})
                  </Text>
                  {memberProjects.length + nonMemberProjects.length > 0 ? (
                    <Separator
                      orientation="horizontal"
                      aria-hidden
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '-48px',
                        right: 0,
                        width: 'calc(100% + 48px)',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                </Flex>
              ),
              textValue: t('All Projects'),
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
            } satisfies SelectOption<number>,
          ]
        : []),
      ...(memberProjects.length < projects.length
        ? [
            {
              value: MY_PROJECTS_VALUE,
              label: (
                <Flex
                  align="center"
                  justify="between"
                  width="100%"
                  style={
                    memberProjects.length + nonMemberProjects.length > 0
                      ? {position: 'relative'}
                      : undefined
                  }
                >
                  <Text>{t('My Projects')}</Text>
                  <Text size="sm" variant="muted">
                    ({memberProjects.length})
                  </Text>
                  {memberProjects.length + nonMemberProjects.length > 0 ? (
                    <Separator
                      orientation="horizontal"
                      aria-hidden
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '-48px',
                        right: 0,
                        width: 'calc(100% + 48px)',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                </Flex>
              ),
              textValue: t('My Projects'),
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
            } satisfies SelectOption<number>,
          ]
        : []),
    ];

    const lastSelected = mapURLValueToNormalValue({
      value: pageFilterValue,
      memberProjectIds: memberProjects.map(project => parseInt(project.id, 10)),
    });
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

    const projectItems = sortBy([...memberProjects, ...nonMemberProjects], listSort).map(
      getProjectItem
    );

    return [...specialItems, ...projectItems];
  }, [
    organization,
    memberProjects,
    nonMemberProjects,
    projects.length,
    optimisticallyBookmarkedProjects,
    pageFilterValue,
    hasStagedValue,
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
    const mappedValue = mapNormalValueToURLValue({
      value: realStagedValue,
      memberProjectIds: memberProjects.map(project => parseInt(project.id, 10)),
      showNonMemberProjects,
    });
    return mappedValue.length > SELECTION_COUNT_LIMIT;
  }, [stagedValue, showNonMemberProjects, memberProjects]);

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

  const stagedSelect = useStagedCompactSelect({
    value,
    options,
    onChange: handleChange,
    onStagedValueChange: setStagedValue,
    onStagedStateChange: setHasStagedValue,
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
        xor(stagedSelect.value, defaultValue).length > 0 ? (
          <MenuComponents.ResetButton onClick={handleReset} />
        ) : null
      }
      menuFooter={
        selectionLimitExceeded ||
        organization.access.includes('project:write') ||
        hasStagedChanges ? (
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
            <Flex
              gap="md"
              align="center"
              justify={organization.access.includes('project:write') ? 'between' : 'end'}
            >
              {organization.access.includes('project:write') ? (
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
      shouldCloseOnInteractOutside={target => {
        // Don't close select menu when clicking on power hovercard ("Requires Business Plan") or disabled feature hovercard
        const powerHovercard = target.closest('[data-test-id="power-hovercard"]');
        const disabledFeatureHovercard = target.closest(
          '[data-test-id="disabled-feature-hovercard"]'
        );
        return !powerHovercard && !disabledFeatureHovercard;
      }}
    />
  );
}

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
  | {stagedValue: number[]; suppressed: {modes: SentinelMode[]; type: 'add'}}
  | {stagedValue: number[]; suppressed: {type: 'clear'}};

function getSentinelSelectionState({
  pageFilterValue,
  stagedValue,
  suppressedCommittedModes,
  hasStagedValue,
}: {
  hasStagedValue: boolean;
  pageFilterValue: number[];
  stagedValue: number[];
  suppressedCommittedModes: Set<SentinelMode>;
}): SentinelSelectionState {
  const stagedSentinelMode: SentinelMode | null = stagedValue.includes(
    ALL_ACCESS_PROJECTS
  )
    ? 'all'
    : stagedValue.includes(MY_PROJECTS_VALUE)
      ? 'my'
      : null;
  const committedAllProjectsMode = pageFilterValue.includes(ALL_ACCESS_PROJECTS);
  const committedMyProjectsMode = pageFilterValue.length === 0;
  const isAllProjectsMode =
    stagedSentinelMode === 'all' ||
    (!suppressedCommittedModes.has('all') && !hasStagedValue && committedAllProjectsMode);
  const isMyProjectsMode =
    isAllProjectsMode ||
    stagedSentinelMode === 'my' ||
    (!suppressedCommittedModes.has('my') && !hasStagedValue && committedMyProjectsMode);

  return {stagedSentinelMode, isAllProjectsMode, isMyProjectsMode};
}

function getMyProjectsToggleTransition({
  isAllProjectsMode,
  isMyProjectsMode,
  stagedSentinelMode,
  nonMemberProjectIds,
}: {
  isAllProjectsMode: boolean;
  isMyProjectsMode: boolean;
  nonMemberProjectIds: number[];
  stagedSentinelMode: SentinelMode | null;
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

function mapURLValueToNormalValue({
  memberProjectIds,
  value,
}: {
  memberProjectIds: number[];
  value: number[];
}): number[] {
  // "All Projects"
  if (value.includes(ALL_ACCESS_PROJECTS)) {
    return [];
  }

  // "My Projects"
  if (!value.length) {
    return memberProjectIds;
  }

  return value;
}

function mapNormalValueToURLValue({
  memberProjectIds,
  showNonMemberProjects,
  value,
}: {
  memberProjectIds: number[];
  showNonMemberProjects: boolean;
  value: number[];
}): number[] {
  if (value.includes(ALL_ACCESS_PROJECTS)) {
    return [ALL_ACCESS_PROJECTS];
  }

  // "All Projects"
  if (!value.length) {
    return [ALL_ACCESS_PROJECTS];
  }

  const memberProjectsSelected = memberProjectIds.every(project =>
    value.includes(project)
  );

  // "My Projects"
  if (
    showNonMemberProjects &&
    value.length === memberProjectIds.length &&
    memberProjectsSelected
  ) {
    return [];
  }

  return value;
}
