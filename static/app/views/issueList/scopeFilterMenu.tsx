import {
  CompactSelect,
  MenuComponents,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {updateEnvironments, updateProjects} from 'sentry/components/pageFilters/actions';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {getAvailableEnvironments} from 'sentry/components/pageFilters/environment/getAvailableEnvironments';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {IconAllProjects, IconCheckmark, IconMyProjects} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjects} from 'sentry/utils/useProjects';

const ALL = '-1';
const MY = '-2';
const UPDATE_OPTIONS = {save: true, resetParams: ['page', 'cursor']};

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every(value => right.includes(value));
}

export function IssueScopeFilterMenu({
  scope,
  onClose,
}: {
  onClose: () => void;
  scope: 'projects' | 'environments';
}) {
  const {projects, initiallyLoaded} = useProjects();
  const {selection, isReady} = usePageFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const isProjects = scope === 'projects';
  const accessible = projects.filter(project => project.hasAccess);
  const allIds = accessible.map(project => project.id);
  const memberIds = accessible
    .filter(project => project.isMember)
    .map(project => project.id);
  const environments = getAvailableEnvironments(projects, new Set(selection.projects));
  const value = isProjects
    ? selection.projects.includes(ALL_ACCESS_PROJECTS)
      ? allIds
      : selection.projects.length === 0
        ? memberIds
        : selection.projects.map(String)
    : selection.environments.filter(environment => environments.has(environment));

  function commit(next: string[]) {
    if (isProjects) {
      const resolved = next.includes(ALL) ? allIds : next.includes(MY) ? memberIds : next;
      const all =
        !next.includes(MY) &&
        (next.includes(ALL) || (resolved.length > 0 && sameValues(resolved, allIds)));
      const mine = sameValues(resolved, memberIds);
      if (!all && !mine && resolved.length > 50) {
        return;
      }
      const projectIds = all ? [ALL_ACCESS_PROJECTS] : mine ? [] : resolved.map(Number);
      const available = getAvailableEnvironments(projects, new Set(projectIds));
      updateProjects(projectIds, location, navigate, {
        ...UPDATE_OPTIONS,
        environments: selection.environments.filter(environment =>
          available.has(environment)
        ),
      });
    } else {
      updateEnvironments(next, location, navigate, UPDATE_OPTIONS);
    }
  }

  const options: Array<SelectOption<string>> = isProjects
    ? [
        {
          value: ALL,
          label: t('All Projects'),
          leadingItems: <IconAllProjects />,
          trailingItems: () =>
            sameValues(stagedSelect.value, allIds) ? (
              <IconCheckmark size="sm" />
            ) : undefined,
        },
        {
          value: MY,
          label: t('My Projects'),
          leadingItems: <IconMyProjects />,
          trailingItems: () =>
            sameValues(stagedSelect.value, memberIds) ? (
              <IconCheckmark size="sm" />
            ) : undefined,
        },
        ...accessible
          .toSorted(
            (a, b) =>
              Number(value.includes(b.id)) - Number(value.includes(a.id)) ||
              Number(!!b.isBookmarked) - Number(!!a.isBookmarked) ||
              a.slug.localeCompare(b.slug)
          )
          .map(project => ({
            value: project.id,
            textValue: project.slug,
            label: <ProjectBadge project={project} avatarSize={16} disableLink />,
          })),
      ]
    : [...environments]
        .sort(
          (a, b) =>
            Number(value.includes(b)) - Number(value.includes(a)) || a.localeCompare(b)
        )
        .map(environment => ({value: environment, label: environment}));

  const stagedSelect = useStagedCompactSelect({
    value,
    options: options.map(option => ({
      ...option,
      leadingItems:
        isProjects && [ALL, MY].includes(option.value)
          ? option.leadingItems
          : ({isSelected}) => (
              <MenuComponents.Checkbox
                checked={isSelected}
                onChange={() => stagedSelect.toggleOption(option.value)}
                aria-label={t('Select %s', option.textValue ?? option.value)}
                tabIndex={-1}
              />
            ),
    })),
    multiple: true,
    onChange: commit,
    filterOptionsOnSearch: option => !isProjects || ![ALL, MY].includes(option.value),
  });
  const changed = !sameValues(value, stagedSelect.value);
  const limitExceeded =
    isProjects &&
    stagedSelect.value.length > 50 &&
    !sameValues(stagedSelect.value, allIds) &&
    !sameValues(stagedSelect.value, memberIds);

  return (
    <CompactSelect
      {...stagedSelect.compactSelectProps}
      onChange={selected => {
        const shortcut =
          isProjects && selected.find(option => [ALL, MY].includes(option.value));
        if (shortcut) {
          commit([shortcut.value]);
          onClose();
          return;
        }
        stagedSelect.compactSelectProps.onChange?.(selected);
      }}
      multiple
      mode="grid"
      menuPresentation="panel"
      menuTitle={isProjects ? t('Projects') : t('Environment')}
      menuWidth={320}
      maxMenuHeight="min(32rem, calc(100vh - 80px))"
      disabled={!initiallyLoaded || !isReady}
      onClose={onClose}
      emptyMessage={isProjects ? t('No projects found') : t('No environments found')}
      menuHeaderTrailingItems={
        <MenuComponents.ResetButton
          onClick={() => {
            commit(isProjects ? [MY] : []);
            onClose();
          }}
        />
      }
      menuFooter={
        changed ? (
          <Stack gap="md">
            {limitExceeded && (
              <MenuComponents.Alert variant="warning">
                {t('Select up to 50 projects, or choose All Projects.')}
              </MenuComponents.Alert>
            )}
            <Flex gap="md" justify="end">
              <MenuComponents.CancelButton
                onClick={() => stagedSelect.dispatch({type: 'remove staged'})}
              />
              <MenuComponents.ApplyButton
                disabled={limitExceeded}
                onClick={() => commit(stagedSelect.value)}
              />
            </Flex>
          </Stack>
        ) : undefined
      }
    />
  );
}
