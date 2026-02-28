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
  // External context/state
  const router = useRouter();
  const routes = useRoutes();
  const organization = useOrganization();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {
    selection: {projects: urlProjectSelection},
    isReady: pageFilterIsReady,
  } = usePageFilters();

  const showNonMemberProjects =
    organization.orgRole === 'owner' ||
    organization.orgRole === 'manager' ||
    organization.features.includes('open-membership');

  // Project grouping and selection normalization
  const [memberProjects, nonMemberProjects] = useMemo(() => {
    const partitionedProjects = partition(projects, project => project.isMember);
    if (showNonMemberProjects) {
      return [partitionedProjects[0], partitionedProjects[1]];
    }

    return [partitionedProjects[0], []];
  }, [projects, showNonMemberProjects]);

  const [memberProjectIds, nonMemberProjectIds, allProjectIds] = useMemo<
    [number[], number[], number[]]
  >(() => {
    const nextMemberProjectIds = memberProjects.map(project => parseInt(project.id, 10));
    const nextNonMemberProjectIds = nonMemberProjects.map(project =>
      parseInt(project.id, 10)
    );
    return [
      nextMemberProjectIds,
      nextNonMemberProjectIds,
      [...nextMemberProjectIds, ...nextNonMemberProjectIds],
    ];
  }, [memberProjects, nonMemberProjects]);

  const defaultMemberSelection = useMemo(
    () =>
      fromURLValue({
        value: [],
        memberProjectIds,
      }),
    [memberProjectIds]
  );
  const committedSelectionIntent = useMemo(
    () =>
      decodeCommittedSelectionIntent({
        urlSelection: urlProjectSelection,
        memberProjectIds,
        allProjectIds,
        showNonMemberProjects,
      }),
    [urlProjectSelection, memberProjectIds, allProjectIds, showNonMemberProjects]
  );
  const committedSelection = committedSelectionIntent.ids;

  // Staged select bridge and menu-local state
  // Ref to break the circular dependency: options need toggleOption/dispatch, but those
  // come from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: number) => void) | undefined>(undefined);
  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);

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

  const [draftSelection, setDraftSelection] = useState<number[]>(committedSelection);

  const options: Array<SelectOption<number>> = (() => {
    const draftSelectionIntent = deriveDraftSelectionIntent({
      selection: draftSelection,
      memberProjectIds,
      allProjectIds,
      showNonMemberProjects,
    });
    const isAllProjectsMode = draftSelectionIntent.kind === 'all';
    const isMyProjectsMode =
      draftSelectionIntent.kind === 'all' || draftSelectionIntent.kind === 'my';

    const handleProjectToggle = (project: Project) => {
      const clickedProjectId = parseInt(project.id, 10);
      if (draftSelectionIntent.kind === 'all' || draftSelectionIntent.kind === 'my') {
        const nextSelection = new Set(draftSelectionIntent.ids);
        if (nextSelection.has(clickedProjectId)) {
          nextSelection.delete(clickedProjectId);
        } else {
          nextSelection.add(clickedProjectId);
        }
        dispatchRef.current?.({type: 'set staged', value: Array.from(nextSelection)});
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
              draftSelectionIntent.kind === 'all'
                ? true
                : draftSelectionIntent.kind === 'my' && project.isMember
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

    const hasMultipleProjects = projects.length > 1;
    const showAllProjectsItem = hasMultipleProjects && nonMemberProjects.length > 0;
    const showMyProjectsItem =
      hasMultipleProjects && memberProjects.length < projects.length;

    const specialItems = [
      ...(showAllProjectsItem
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
                  <Text size="xs" variant="muted">
                    ({projects.length})
                  </Text>
                  {showMyProjectsItem ? null : (
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
                  )}
                </Flex>
              ),
              textValue: t('All Projects'),
              leadingItems: () => (
                <Fragment>
                  <MenuComponents.Checkbox
                    checked={isAllProjectsMode}
                    onChange={() => {
                      dispatchRef.current?.({
                        type: 'set staged',
                        value: isAllProjectsMode ? [] : [ALL_ACCESS_PROJECTS],
                      });
                    }}
                    aria-label={t('Select All Projects')}
                    tabIndex={-1}
                  />
                  <IconAllProjects size="sm" variant="muted" />
                </Fragment>
              ),
            } satisfies SelectOption<number>,
          ]
        : []),
      ...(showMyProjectsItem
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
                  <Text size="xs" variant="muted">
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
                    onChange={() => {
                      if (draftSelectionIntent.kind === 'all') {
                        dispatchRef.current?.({
                          type: 'set staged',
                          value: nonMemberProjectIds,
                        });
                        return;
                      }

                      if (draftSelectionIntent.kind === 'my') {
                        dispatchRef.current?.({type: 'set staged', value: []});
                        return;
                      }

                      dispatchRef.current?.({
                        type: 'set staged',
                        value: [MY_PROJECTS_VALUE],
                      });
                    }}
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

    const lastSelected = fromURLValue({
      value: urlProjectSelection,
      memberProjectIds,
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
  })();

  // Selection staging and commit behavior
  const selectionLimitExceeded = (() => {
    const stagedSelectionIntent = deriveDraftSelectionIntent({
      selection: draftSelection,
      memberProjectIds,
      allProjectIds,
      showNonMemberProjects,
    });

    if (draftSelection.includes(ALL_ACCESS_PROJECTS)) {
      return false;
    }
    if (
      urlProjectSelection.includes(ALL_ACCESS_PROJECTS) &&
      stagedSelectionIntent.kind === 'all'
    ) {
      return false;
    }

    const realStagedValue = draftSelection.filter(
      v => v !== ALL_ACCESS_PROJECTS && v !== MY_PROJECTS_VALUE
    );
    return realStagedValue.length > SELECTION_COUNT_LIMIT;
  })();

  const onToggle = useCallback(
    (newValue: number[]) => {
      trackAnalytics('projectselector.toggle', {
        action: newValue.length > draftSelection.length ? 'added' : 'removed',
        path: getRouteStringFromRoutes(routes),
        organization,
      });
    },
    [draftSelection, routes, organization]
  );

  const onReplace = useCallback(() => {
    trackAnalytics('projectselector.direct_selection', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [routes, organization]);

  const commitSelection = useCallback(
    (newValue: number[]) => {
      // Translate sentinel values to their actual project ID lists
      let resolvedValue = newValue;
      if (newValue.includes(ALL_ACCESS_PROJECTS)) {
        resolvedValue = [];
      } else if (newValue.includes(MY_PROJECTS_VALUE)) {
        resolvedValue = defaultMemberSelection;
      }

      onChange?.(resolvedValue);

      trackAnalytics('projectselector.update', {
        count: resolvedValue.length,
        path: getRouteStringFromRoutes(routes),
        organization,
        multi: resolvedValue.length > 1,
      });

      updateProjects(
        toURLValue({
          allProjectIds,
          value: resolvedValue,
          memberProjectIds,
          showNonMemberProjects,
        }),
        router,
        {
          save: true,
          resetParams: resetParamsOnChange,
          // Why are we clearing the environments when switching projects?
          environments: [],
          storageNamespace,
        }
      );
    },
    [
      defaultMemberSelection,
      allProjectIds,
      memberProjectIds,
      showNonMemberProjects,
      resetParamsOnChange,
      router,
      organization,
      routes,
      onChange,
      storageNamespace,
    ]
  );

  const filterOptionsOnSearch = useCallback((option: SelectOption<number>) => {
    return option.value !== ALL_ACCESS_PROJECTS && option.value !== MY_PROJECTS_VALUE;
  }, []);

  const stagedSelect = useStagedCompactSelect({
    value: committedSelection,
    options,
    onChange: commitSelection,
    onStagedValueChange: setDraftSelection,
    onToggle,
    onReplace,
    filterOptionsOnSearch,
    multiple: true,
    disableCommit: selectionLimitExceeded,
  });

  // Wire up refs after stagedSelect is created to break the circular dependency between
  // options (which need toggleOption/dispatch) and useStagedCompactSelect (which needs options).
  toggleOptionRef.current = stagedSelect.toggleOption;
  dispatchRef.current = stagedSelect.dispatch;

  // Derived intent and UI actions
  const {dispatch} = stagedSelect;
  const clearDraftSelectionState = useCallback(() => {
    dispatch({type: 'remove staged'});
  }, [dispatch]);

  const draftSelectionIntent = useMemo(
    () =>
      deriveDraftSelectionIntent({
        selection: stagedSelect.value,
        memberProjectIds,
        allProjectIds,
        showNonMemberProjects,
      }),
    [stagedSelect.value, memberProjectIds, allProjectIds, showNonMemberProjects]
  );

  // Keep existing behavior: if committed state is "My Projects", deselecting everything
  // should not auto-commit on outside click.
  const isMyProjectsDeselectedOnly =
    committedSelectionIntent.kind === 'my' && draftSelectionIntent.kind === 'none';

  // Merge the hook's onOpenChange (resets shift-click anchor) with the local
  // snapshot logic (freezes the bookmark sort order while the menu is open).
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        bookmarkedSnapshotRef.current = new Set(optimisticallyBookmarkedProjects);
        dispatch({type: 'reset anchor'});
      }
    },
    [dispatch, optimisticallyBookmarkedProjects]
  );

  const handleReset = useCallback(() => {
    clearDraftSelectionState();
    commitSelection(defaultMemberSelection);
    onReset?.();

    trackAnalytics('projectselector.clear', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
  }, [
    clearDraftSelectionState,
    commitSelection,
    defaultMemberSelection,
    onReset,
    routes,
    organization,
  ]);

  const handleCancel = useCallback(() => {
    trackAnalytics('projectselector.cancel', {
      path: getRouteStringFromRoutes(routes),
      organization,
    });
    clearDraftSelectionState();
  }, [clearDraftSelectionState, routes, organization]);

  const handleApply = useCallback(() => {
    trackAnalytics('projectselector.apply', {
      count: stagedSelect.value.length,
      multi: stagedSelect.value.length > 1,
      path: getRouteStringFromRoutes(routes),
      organization,
    });
    // Committing the selection immediately causes the UI to block th thread (we update QS which rerenders the entire app)
    // This is a workaround to ensure the UI is responsive and that the menu closes immediately after a user action
    requestAnimationFrame(() => {
      clearDraftSelectionState();
      commitSelection(stagedSelect.value);
    });
  }, [
    clearDraftSelectionState,
    commitSelection,
    routes,
    organization,
    stagedSelect.value,
  ]);

  const defaultMenuWidth = useMemo(() => computeMenuWidth(options), [options]);

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
          ? clearDraftSelectionState
          : stagedSelect.compactSelectProps.onInteractOutside
      }
      onOpenChange={handleOpenChange}
      menuHeaderTrailingItems={
        xor(stagedSelect.value, defaultMemberSelection).length > 0 ? (
          <MenuComponents.ResetButton onClick={handleReset} />
        ) : null
      }
      menuFooter={
        selectionLimitExceeded ||
        organization.access.includes('project:write') ||
        (!isMyProjectsDeselectedOnly &&
          xor(stagedSelect.value, committedSelection).length > 0) ? (
          <Stack gap="md" direction="column">
            {selectionLimitExceeded && (
              <MenuComponents.Alert variant="warning">
                {tct(
                  `You've selected [count] projects, but only up to [limit] can be selected at a time. Select All Projects to view all projects.`,
                  {
                    limit: SELECTION_COUNT_LIMIT,
                    count: stagedSelect.value.length,
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
              <Flex gap="md" align="center" justify="end">
                <MenuComponents.CancelButton onClick={handleCancel} />
                <MenuComponents.ApplyButton
                  disabled={selectionLimitExceeded}
                  onClick={handleApply}
                />
              </Flex>
            </Flex>
          </Stack>
        ) : null
      }
      trigger={
        trigger ??
        (triggerProps => (
          <ProjectPageFilterTrigger
            {...triggerProps}
            value={committedSelection}
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
type SelectionIntentKind = 'all' | 'my' | 'custom' | 'none';
interface SelectionIntent {
  ids: number[];
  kind: SelectionIntentKind;
}

function decodeCommittedSelectionIntent({
  allProjectIds,
  memberProjectIds,
  showNonMemberProjects,
  urlSelection,
}: {
  allProjectIds: number[];
  memberProjectIds: number[];
  showNonMemberProjects: boolean;
  urlSelection: number[];
}): SelectionIntent {
  if (urlSelection.includes(ALL_ACCESS_PROJECTS)) {
    return {kind: 'all', ids: allProjectIds};
  }

  if (urlSelection.length === 0) {
    if (showNonMemberProjects) {
      return {kind: 'my', ids: memberProjectIds};
    }
    return {kind: 'all', ids: allProjectIds};
  }

  return deriveDraftSelectionIntent({
    selection: urlSelection,
    memberProjectIds,
    allProjectIds,
    showNonMemberProjects,
  });
}

function deriveDraftSelectionIntent({
  allProjectIds,
  memberProjectIds,
  selection,
  showNonMemberProjects,
}: {
  allProjectIds: number[];
  memberProjectIds: number[];
  selection: number[];
  showNonMemberProjects: boolean;
}): SelectionIntent {
  if (selection.includes(ALL_ACCESS_PROJECTS)) {
    return {kind: 'all', ids: allProjectIds};
  }
  if (selection.includes(MY_PROJECTS_VALUE)) {
    return {kind: 'my', ids: memberProjectIds};
  }
  if (selection.length === 0) {
    return {kind: 'none', ids: []};
  }

  if (hasSameValues(selection, allProjectIds)) {
    return {kind: 'all', ids: allProjectIds};
  }
  if (showNonMemberProjects && hasSameValues(selection, memberProjectIds)) {
    return {kind: 'my', ids: memberProjectIds};
  }

  return {kind: 'custom', ids: selection};
}

function hasSameValues(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightValues = new Set(right);
  return left.every(value => rightValues.has(value));
}

function fromURLValue({
  memberProjectIds,
  value,
}: {
  memberProjectIds: number[];
  value: number[];
}): number[] {
  if (value.includes(ALL_ACCESS_PROJECTS)) {
    return [];
  }

  // "My Projects"
  if (!value.length) {
    return memberProjectIds;
  }

  return value;
}

function toURLValue({
  allProjectIds,
  memberProjectIds,
  showNonMemberProjects,
  value,
}: {
  allProjectIds: number[];
  memberProjectIds: number[];
  showNonMemberProjects: boolean;
  value: number[];
}): number[] {
  if (value.includes(ALL_ACCESS_PROJECTS) || !value.length) {
    return [ALL_ACCESS_PROJECTS];
  }

  if (hasSameValues(value, allProjectIds)) {
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

function computeMenuWidth(options: Array<SelectOption<number>>): string {
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
  return `${Math.max(22, Math.min(28, longestSlugLength * 0.6 + 12))}em`;
}
