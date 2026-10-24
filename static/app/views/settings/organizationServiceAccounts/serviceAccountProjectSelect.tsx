import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {isAppleDevice} from '@react-aria/utils';
import {IconAllProjects} from '@sentry/icons/allProjects';
import {IconMyProjects} from '@sentry/icons/myProjects';
import sortBy from 'lodash/sortBy';
import xor from 'lodash/xor';

import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {ProjectPageFilterTrigger} from 'sentry/components/pageFilters/project/projectPageFilterTrigger';
import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

/**
 * Sentinel value for the "My Projects" quick-select option. ALL_ACCESS_PROJECTS (-1) is
 * already used for "All Projects".
 */
const MY_PROJECTS_VALUE = -2;

export {ALL_ACCESS_PROJECTS};

interface ServiceAccountProjectSelectProps {
  onChange: (value: number[]) => void;
  /** Selected project IDs. `[ALL_ACCESS_PROJECTS]` is accepted as a shorthand for all of them. */
  value: number[];
}

/**
 * A copy of `ProjectPageFilter` for picking a service account's projects. It looks and
 * behaves like the page filter's project selector, but it is a controlled form field:
 * it does not read or write the URL or the global page filters. It only lists projects the
 * creator can access, since a service account can never get more access than its creator.
 * "All Projects" means every one of those projects at the time the account is created.
 */
export function ServiceAccountProjectSelect({
  onChange,
  value,
}: ServiceAccountProjectSelectProps) {
  const {projects, initiallyLoaded: projectsLoaded} = useAccessibleProjects();

  const committedSelectionIntent = useMemo(
    () => selectionToIntent({projects, selection: value}),
    [value, projects]
  );

  // We need to backpropagate the staged value to the options so that we can update the UI.
  const [stagedValue, setStagedValue] = useState(committedSelectionIntent.ids);

  // Refs break the circular dependency: options need toggleOption/dispatch, but those
  // come from useStagedCompactSelect, which depends on options. They are only read in
  // event handlers, and set in a layout effect below.
  const dispatchRef = useRef<React.Dispatch<any> | undefined>(undefined);
  const toggleOptionRef = useRef<((val: number) => void) | undefined>(undefined);

  const options = useMemo<Array<SelectOption<number>>>(() => {
    const optionSelectionIntent = selectionToIntent({projects, selection: stagedValue});

    const getProjectItem = (project: Project) =>
      ({
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
              // When a sentinel is staged, expand it to explicit IDs first, then
              // remove this project.
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
      }) satisfies SelectOption<number>;

    const memberProjectList = memberProjects(projects);

    const specialItems = [
      ...(projects.length > 1
        ? [
            {
              value: ALL_ACCESS_PROJECTS,
              label: (
                <QuickSelectLabel
                  icon={<IconAllProjects size="md" variant="muted" />}
                  label={t('All Projects')}
                  count={projects.length}
                  showDivider={memberProjectList.length === 0}
                />
              ),
              textValue: t('All Projects'),
              leadingItems: () => (
                <MenuComponents.Checkbox
                  checked={optionSelectionIntent.kind === 'all'}
                  onChange={() => {
                    dispatchRef.current?.({
                      type: 'set staged',
                      // The inverse of All Projects is an empty array
                      value:
                        optionSelectionIntent.kind === 'all' ? [] : [ALL_ACCESS_PROJECTS],
                    });
                  }}
                  aria-label={t('Select All Projects')}
                  tabIndex={-1}
                />
              ),
            } satisfies SelectOption<number>,
          ]
        : []),
      ...(memberProjectList.length > 0 && memberProjectList.length < projects.length
        ? [
            {
              value: MY_PROJECTS_VALUE,
              label: (
                <QuickSelectLabel
                  icon={<IconMyProjects size="md" variant="muted" />}
                  label={t('My Projects')}
                  count={memberProjectList.length}
                  showDivider
                />
              ),
              textValue: t('My Projects'),
              leadingItems: () => (
                <MenuComponents.Checkbox
                  checked={
                    optionSelectionIntent.kind === 'all' ||
                    optionSelectionIntent.kind === 'my'
                  }
                  onChange={() => {
                    if (optionSelectionIntent.kind === 'all') {
                      // Remove member projects from the "all" selection
                      dispatchRef.current?.({
                        type: 'set staged',
                        value: nonMemberProjectIds(projects),
                      });
                      return;
                    }
                    if (optionSelectionIntent.kind === 'my') {
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
              ),
            } satisfies SelectOption<number>,
          ]
        : []),
    ];

    const lastSelected = value.includes(ALL_ACCESS_PROJECTS) ? [] : value;
    const projectItems = sortBy(projects, project => [
      !lastSelected.includes(parseInt(project.id, 10)),
      !project.isMember,
      project.slug,
    ]).map(getProjectItem);

    return [...specialItems, ...projectItems];
    // The refs are read in event handlers only, so they are left out on purpose
    // (same as ProjectPageFilter).
    // oxlint-disable-next-line react/memo-dependencies
  }, [projects, stagedValue, value]);

  const commitSelection = (newValue: number[]) => {
    // Resolve the sentinels to the projects that exist right now.
    if (newValue.includes(ALL_ACCESS_PROJECTS)) {
      onChange(allProjectIds(projects));
    } else if (newValue.includes(MY_PROJECTS_VALUE)) {
      onChange(memberProjectIds(projects));
    } else {
      onChange(newValue);
    }
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
    filterOptionsOnSearch,
    multiple: true,
  });

  useLayoutEffect(() => {
    dispatchRef.current = stagedSelect.dispatch;
    toggleOptionRef.current = stagedSelect.toggleOption;
  });

  const clearDraftSelectionState = () => {
    stagedSelect.dispatch({type: 'remove staged'});
  };

  const handleApply = () => {
    clearDraftSelectionState();
    commitSelection(stagedSelect.value);
  };

  const hasUnstagedChanges =
    xor(stagedSelect.value, committedSelectionIntent.ids).length > 0;

  return (
    <CompactSelect
      mode="grid"
      multiple
      {...stagedSelect.compactSelectProps}
      disabled={!projectsLoaded}
      emptyMessage={t('No projects found')}
      menuTitle={
        <Flex gap="xs" align="center">
          <Text>{t('Projects')}</Text>
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
      }
      menuWidth={computeMenuWidth(options)}
      onInteractOutside={
        hasUnstagedChanges
          ? stagedSelect.compactSelectProps.onInteractOutside
          : clearDraftSelectionState
      }
      onOpenChange={open => {
        if (open) {
          stagedSelect.dispatch({type: 'reset anchor'});
        }
      }}
      menuFooter={
        hasUnstagedChanges ? (
          <Flex gap="md" align="center" justify="end" width="100%">
            <MenuComponents.CancelButton onClick={clearDraftSelectionState} />
            <MenuComponents.ApplyButton onClick={handleApply} />
          </Flex>
        ) : null
      }
      trigger={triggerProps => (
        <ProjectPageFilterTrigger
          {...triggerProps}
          value={committedSelectionIntent.ids}
          memberProjects={memberProjects(projects)}
          nonMemberProjects={nonMemberProjects(projects)}
          ready={projectsLoaded}
        />
      )}
    />
  );
}

/**
 * Label for the "All Projects" / "My Projects" quick-select options. Copied from
 * `ProjectPageFilter`.
 */
function QuickSelectLabel({
  icon,
  label,
  count,
  showDivider,
}: {
  count: number;
  icon: React.ReactNode;
  label: string;
  showDivider: boolean;
}) {
  return (
    <Flex align="center" justify="between" gap="sm" flex="1 1 100%">
      <Flex align="center" gap="sm" minWidth="0">
        <Flex flexShrink={0}>{icon}</Flex>
        <Text ellipsis>{label}</Text>
      </Flex>
      <Text size="xs" variant="muted">
        ({count})
      </Text>
      {showDivider ? (
        <Container
          aria-hidden
          position="absolute"
          bottom="-4px"
          left="-24px"
          right="0"
          pointerEvents="none"
        >
          <Separator orientation="horizontal" border="muted" />
        </Container>
      ) : null}
    </Flex>
  );
}

/**
 * Projects the creator can access. A service account can only be given projects from
 * this list.
 */
export function useAccessibleProjects() {
  const {projects, initiallyLoaded} = useProjects();
  const accessibleProjects = useMemo(
    () => projects.filter(project => project.hasAccess),
    [projects]
  );
  return {projects: accessibleProjects, initiallyLoaded};
}

type SelectionIntentKind = 'all' | 'my' | 'custom' | 'none';
interface SelectionIntent {
  ids: number[];
  kind: SelectionIntentKind;
}

/**
 * Converts an array of project IDs (which may contain sentinel values -1 or -2) to a
 * SelectionIntent. An empty array means no projects selected.
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
  if (
    selection.includes(ALL_ACCESS_PROJECTS) ||
    hasSameValues(selection, allProjectIds(projects))
  ) {
    return {kind: 'all', ids: allProjectIds(projects)};
  }
  if (selection.includes(MY_PROJECTS_VALUE)) {
    return {kind: 'my', ids: memberProjectIds(projects)};
  }
  if (hasSameValues(selection, memberProjectIds(projects))) {
    return {kind: 'my', ids: memberProjectIds(projects)};
  }
  return {kind: 'custom', ids: selection};
}

function computeMenuWidth(options: Array<SelectOption<number>>): string {
  const longestSlugLength = options.reduce((acc, cur) => {
    const length = cur.textValue?.length ?? 0;
    return length > acc ? length : acc;
  }, 0);
  return `${Math.max(22, Math.min(28, longestSlugLength * 0.6 + 12))}em`;
}

function memberProjects(projects: Project[]): Project[] {
  return projects.filter(project => project.isMember);
}

function memberProjectIds(projects: Project[]): number[] {
  return memberProjects(projects).map(project => parseInt(project.id, 10));
}

function nonMemberProjects(projects: Project[]): Project[] {
  return projects.filter(project => !project.isMember);
}

function nonMemberProjectIds(projects: Project[]): number[] {
  return nonMemberProjects(projects).map(project => parseInt(project.id, 10));
}

function allProjectIds(projects: Project[]): number[] {
  return projects.map(project => parseInt(project.id, 10));
}

function hasSameValues(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightValues = new Set(right);
  return left.every(v => rightValues.has(v));
}
