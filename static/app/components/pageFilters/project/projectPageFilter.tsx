import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {isAppleDevice} from '@react-aria/utils';
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
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
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
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useRouter} from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

/**
 * Maximum number of projects that can be selected at a time (due to server limits). This
 * does not apply to special values like "My Projects" and "All Projects".
 */
const SELECTION_COUNT_LIMIT = 50;

export interface ProjectPageFilterProps extends Partial<
  Omit<MultipleSelectProps<number>, 'onChange' | 'sizeLimit' | 'trigger' | 'emptyMessage'>
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

export function ProjectPageFilter({
  onChange,
  onReset,
  disabled,
  menuTitle,
  menuWidth,
  resetParamsOnChange,
  storageNamespace,
  ...selectProps
}: ProjectPageFilterProps) {
  // External context/state
  const router = useRouter();
  const routes = useRoutes();
  const organization = useOrganization();
  // Project data s
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {
    selection: {projects: urlProjectSelection},
    isReady: pageFilterIsReady,
  } = usePageFilters();

  const committedSelectionIntent = useMemo(
    () =>
      urlSelectionToIntent({
        projects,
        urlSelection: urlProjectSelection,
      }),
    [urlProjectSelection, projects]
  );

  // Track optimistically bookmarked projects to prevent star from disappearing
  // during API call when user bookmarks and quickly moves focus
  const [optimisticallyBookmarkedProjects, setOptimisticallyBookmarkedProjects] =
    useState<Set<string>>(
      () => new Set(projects.filter(p => p.isBookmarked).map(p => p.id))
    );
  const bookmarkedSnapshotRef = useRef(new Set(optimisticallyBookmarkedProjects));

  // Staged select bridge and menu-local state
  // Ref to break the circular dependency: options need toggleOption/dispatch, but those
  // come from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: number) => void) | undefined>(undefined);
  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);

  // We need to backpropagate the staged value to the options so that we can update the UI.
  const [stagedValue, setStagedValue] = useState<number[]>(committedSelectionIntent.ids);

  const options = useMemo<Array<SelectOption<number>>>(() => {
    const optionSelectionIntent = selectionToIntent({
      projects,
      selection: stagedValue,
    });

    const getProjectItem = (project: Project) => {
      return {
        value: parseInt(project.id, 10),
        textValue: project.slug,
        leadingItems: ({isSelected}) => (
          <MenuComponents.Checkbox
            checked={
              optionSelectionIntent.kind === 'all' ||
              (optionSelectionIntent.kind === 'my' && project.isMember)
                ? true
                : isSelected
            }
            onChange={() => {
              const projectId = parseInt(project.id, 10);
              // When a sentinel is staged, the checkbox appears checked via the
              // `checked` override above — but toggleOption would just add the
              // ID alongside the sentinel (e.g. [-1, 1]), keeping kind='all'.
              // Instead, expand to explicit IDs first, then remove this project.
              if (optionSelectionIntent.kind === 'all') {
                dispatchRef.current?.({
                  type: 'set staged',
                  value: allProjectIds(projects).filter(id => id !== projectId),
                });
              } else if (optionSelectionIntent.kind === 'my' && project.isMember) {
                dispatchRef.current?.({
                  type: 'set staged',
                  value: memberProjectIds(projects).filter(id => id !== projectId),
                });
              } else {
                toggleOptionRef.current?.(projectId);
              }
            }}
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

    const memberProjectList = memberProjects(projects);
    const nonMemberProjectList = nonMemberProjects(projects);

    const specialItems = [
      ...(projects.length > 1 && nonMemberProjectList.length > 0
        ? [
            {
              value: ALL_ACCESS_PROJECTS,
              label: (
                <Flex align="center" justify="between" width="100%">
                  <Text>{t('All Projects')}</Text>
                  <Text size="xs" variant="muted">
                    ({projects.length})
                  </Text>
                  {/* Show separator if we are not displaying My Projects */}
                  {memberProjectList.length > 0 ? null : (
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
                    checked={optionSelectionIntent.kind === 'all'}
                    onChange={() => {
                      // Toggle: always select all projects when clicked
                      dispatchRef.current?.({
                        type: 'set staged',
                        value: [ALL_ACCESS_PROJECTS],
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
      ...(memberProjectList.length > 0 && memberProjectList.length < projects.length
        ? [
            {
              value: MY_PROJECTS_VALUE,
              label: (
                <Flex align="center" justify="between" width="100%">
                  <Text>{t('My Projects')}</Text>
                  <Text size="xs" variant="muted">
                    ({memberProjectList.length})
                  </Text>
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
                </Flex>
              ),
              textValue: t('My Projects'),
              leadingItems: () => (
                <Fragment>
                  <MenuComponents.Checkbox
                    checked={optionSelectionIntent.kind === 'my'}
                    onChange={() => {
                      // Toggle: always select my projects when clicked
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

    // Expand the URL selection to real IDs: empty URL = My Projects = all member IDs.
    const lastSelected = urlProjectSelection.includes(ALL_ACCESS_PROJECTS)
      ? []
      : urlProjectSelection.length === 0
        ? memberProjectIds(projects)
        : urlProjectSelection;

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

    const projectItems = sortBy(
      [...memberProjectList, ...nonMemberProjectList],
      listSort
    ).map(getProjectItem);

    return [...specialItems, ...projectItems];
  }, [
    projects,
    stagedValue,
    urlProjectSelection,
    optimisticallyBookmarkedProjects,
    organization,
  ]);

  const routePath = useMemo(() => getRouteStringFromRoutes(routes), [routes]);

  // Selection staging and commit behavior
  const selectionLimitExceeded = useMemo(() => {
    const stagedSelectionIntent = selectionToIntent({
      projects,
      selection: stagedValue,
    });

    if (stagedSelectionIntent.kind === 'my') {
      return false;
    }

    if (stagedValue.includes(ALL_ACCESS_PROJECTS)) {
      return false;
    }
    if (
      urlProjectSelection.includes(ALL_ACCESS_PROJECTS) &&
      stagedSelectionIntent.kind === 'all'
    ) {
      return false;
    }

    const realStagedValue = stagedValue.filter(
      v => v !== ALL_ACCESS_PROJECTS && v !== MY_PROJECTS_VALUE
    );
    return realStagedValue.length > SELECTION_COUNT_LIMIT;
  }, [stagedValue, urlProjectSelection, projects]);

  const onToggle = (newValue: number[]) => {
    trackAnalytics('projectselector.toggle', {
      action: newValue.length > stagedValue.length ? 'added' : 'removed',
      path: routePath,
      organization,
    });
  };

  const onReplace = () => {
    trackAnalytics('projectselector.direct_selection', {
      path: routePath,
      organization,
    });
  };

  const commitSelection = (newValue: number[]) => {
    // Translate sentinel values to their actual project ID lists
    let resolvedValue = newValue;
    if (newValue.includes(ALL_ACCESS_PROJECTS)) {
      resolvedValue = [];
    } else if (newValue.includes(MY_PROJECTS_VALUE)) {
      resolvedValue = memberProjectIds(projects);
    }

    onChange?.(resolvedValue);

    trackAnalytics('projectselector.update', {
      count: resolvedValue.length,
      path: routePath,
      organization,
      multi: resolvedValue.length > 1,
    });

    updateProjects(
      toURLSelection({
        projects,
        // Preserve the ALL_ACCESS_PROJECTS sentinel before it gets expanded to []
        // so toURLSelection can distinguish "All Projects selected" from "nothing selected".
        value: newValue.includes(ALL_ACCESS_PROJECTS) ? newValue : resolvedValue,
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
  };

  const filterOptionsOnSearch = useCallback(
    (option: SelectOption<number>) =>
      option.value !== ALL_ACCESS_PROJECTS && option.value !== MY_PROJECTS_VALUE,
    []
  );

  const stagedSelect = useStagedCompactSelect({
    value: committedSelectionIntent.ids,
    options,
    onChange: commitSelection,
    onStagedValueChange: setStagedValue,
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
  const clearDraftSelectionState = () => {
    stagedSelect.dispatch({type: 'remove staged'});
  };

  // Merge the hook's onOpenChange (resets shift-click anchor) with the local
  // snapshot logic (freezes the bookmark sort order while the menu is open).
  const handleOpenChange = (open: boolean) => {
    if (open) {
      bookmarkedSnapshotRef.current = new Set(optimisticallyBookmarkedProjects);
      stagedSelect.dispatch({type: 'reset anchor'});
    }
  };

  const handleReset = () => {
    clearDraftSelectionState();
    commitSelection(memberProjectIds(projects));
    onReset?.();

    trackAnalytics('projectselector.clear', {
      path: routePath,
      organization,
    });
  };

  const handleCancel = () => {
    trackAnalytics('projectselector.cancel', {
      path: routePath,
      organization,
    });
    clearDraftSelectionState();
  };

  const handleApply = () => {
    trackAnalytics('projectselector.apply', {
      count: stagedSelect.value.length,
      multi: stagedSelect.value.length > 1,
      path: routePath,
      organization,
    });
    // Committing the selection immediately causes the UI to block th thread (we update QS which rerenders the entire app)
    // This is a workaround to ensure the UI is responsive and that the menu closes immediately after a user action
    setTimeout(() => {
      clearDraftSelectionState();
      commitSelection(stagedSelect.value);
    }, 0);
  };

  const defaultMenuWidth = useMemo(() => computeMenuWidth(options), [options]);

  const canWrite = organization.access.includes('project:write');

  const hasUnstaggedChanges =
    xor(stagedSelect.value, committedSelectionIntent.ids).length > 0;

  const menuFooterContent =
    selectionLimitExceeded || canWrite || hasUnstaggedChanges ? (
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
        <Flex gap="md" align="center" justify={canWrite ? 'between' : 'end'}>
          {canWrite ? (
            <MenuComponents.CTALinkButton
              icon={<IconAdd />}
              to={makeProjectsPathname({path: '/new/', organization})}
              onClick={handleApply}
            >
              {t('Create Project')}
            </MenuComponents.CTALinkButton>
          ) : undefined}
          {hasUnstaggedChanges ? (
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
    ) : null;

  return (
    <CompactSelect
      grid
      multiple
      {...selectProps}
      {...stagedSelect.compactSelectProps}
      disabled={disabled ?? (!projectsLoaded || !pageFilterIsReady)}
      emptyMessage={t('No projects found')}
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
        hasUnstaggedChanges
          ? stagedSelect.compactSelectProps.onInteractOutside
          : clearDraftSelectionState
      }
      onOpenChange={handleOpenChange}
      menuHeaderTrailingItems={
        xor(stagedSelect.value, memberProjectIds(projects)).length > 0 ? (
          <MenuComponents.ResetButton onClick={handleReset} />
        ) : null
      }
      menuFooter={menuFooterContent}
      trigger={triggerProps => (
        <ProjectPageFilterTrigger
          {...triggerProps}
          value={committedSelectionIntent.ids}
          memberProjects={memberProjects(projects)}
          nonMemberProjects={nonMemberProjects(projects)}
          ready={projectsLoaded && pageFilterIsReady}
        />
      )}
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

/**
 * Converts a URL project selection to a SelectionIntent.
 *
 * The URL uses a compact encoding: an empty array means "My Projects" (not "none"),
 * and [-1] means "All Projects". This function decodes that encoding and delegates
 * to selectionToIntent for non-empty, non-sentinel selections.
 */
function urlSelectionToIntent({
  projects,
  urlSelection,
}: {
  projects: Project[];
  urlSelection: number[];
}): SelectionIntent {
  if (urlSelection.includes(ALL_ACCESS_PROJECTS)) {
    return {kind: 'all', ids: allProjectIds(projects)};
  }

  // Empty URL = "My Projects" (not "none" — that would be no selection at all).
  // This holds regardless of showNonMemberProjects: in closed orgs the user's member
  // projects are their accessible projects, so the default is still "My Projects".
  if (urlSelection.length === 0) {
    return {kind: 'my', ids: memberProjectIds(projects)};
  }

  return selectionToIntent({
    projects,
    selection: urlSelection,
  });
}

/**
 * Converts an array of project IDs (which may contain sentinel values -1 or -2)
 * to a SelectionIntent. Unlike urlSelectionToIntent, an empty array means "none"
 * (no projects selected), not "My Projects".
 */
function selectionToIntent({
  projects,
  selection,
}: {
  projects: Project[];
  selection: number[];
}): SelectionIntent {
  if (selection.length === 0) {
    return {kind: 'none', ids: []};
  }

  if (selection.includes(ALL_ACCESS_PROJECTS)) {
    return {kind: 'all', ids: allProjectIds(projects)};
  }
  if (selection.includes(MY_PROJECTS_VALUE)) {
    return {kind: 'my', ids: memberProjectIds(projects)};
  }

  // If the user manually selected all projects
  if (hasSameValues(selection, allProjectIds(projects))) {
    return {kind: 'all', ids: allProjectIds(projects)};
  }

  // If the user manually selected my projects — applies regardless of showNonMemberProjects
  // so closed-org users see the "My Projects" checkbox checked when appropriate.
  if (hasSameValues(selection, memberProjectIds(projects))) {
    return {kind: 'my', ids: memberProjectIds(projects)};
  }

  return {kind: 'custom', ids: selection};
}

/**
 * Converts an internal project selection (expanded IDs) to the URL encoding.
 * Detects when the selection equals "all projects" or "my projects" and collapses
 * it to the compact URL representations (-1 and [] respectively).
 */
function toURLSelection({
  projects,
  value,
}: {
  projects: Project[];
  value: number[];
}): number[] {
  if (value.includes(ALL_ACCESS_PROJECTS)) {
    return [ALL_ACCESS_PROJECTS];
  }

  if (hasSameValues(value, allProjectIds(projects))) {
    return [ALL_ACCESS_PROJECTS];
  }

  const memberProjectsSelected = memberProjectIds(projects).every(project =>
    value.includes(project)
  );

  // "My Projects" — applies regardless of showNonMemberProjects so closed-org
  // selections round-trip correctly through the compact [] URL encoding.
  if (value.length === memberProjectIds(projects).length && memberProjectsSelected) {
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

// Helper functions for data selection
function memberProjects(projects: Project[]): Project[] {
  return projects.filter(project => project.isMember);
}

function memberProjectIds(projects: Project[]): number[] {
  return memberProjects(projects).map(project => parseInt(project.id, 10));
}

function nonMemberProjects(projects: Project[]): Project[] {
  return projects.filter(project => !project.isMember);
}

function allProjectIds(projects: Project[]): number[] {
  return projects.map(project => parseInt(project.id, 10));
}

function hasSameValues(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightValues = new Set(right);
  return left.every(value => rightValues.has(value));
}
