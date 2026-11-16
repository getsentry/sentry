import {useCallback, useEffect, useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {updateProjects} from 'sentry/components/pageFilters/actions';
import {getAvailableEnvironments} from 'sentry/components/pageFilters/environment/getAvailableEnvironments';
import {getPageFilterStorage} from 'sentry/components/pageFilters/persistence';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {sortProjectsByBookmarkAndMembership} from 'sentry/utils/project/sortProjects';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

function findPreselectedProject(
  sortedProjects: Project[],
  candidateIds: number[]
): Project | undefined {
  for (const id of candidateIds) {
    const project = sortedProjects.find(({id: projectId}) => projectId === String(id));
    if (project) {
      return project;
    }
  }
  return (
    sortedProjects.find(project => project.hasInsightsAgentMonitoring) ??
    sortedProjects[0]
  );
}

/**
 * Single-select project filter, as a classifier belongs to exactly one project.
 * The selection lives in the page filters, so everything else on the page
 * follows it. If the filters don't resolve to one project, it picks one: the
 * first selected or last used project, else one with agent monitoring.
 */
export function ClassifierProjectSelect({resetParams}: {resetParams?: string[]}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {projects} = useProjects();
  const {selection, isReady} = usePageFilters();

  const sortedProjects = useMemo(
    () => sortProjectsByBookmarkAndMembership(projects),
    [projects]
  );
  const selectedProject =
    selection.projects.length === 1
      ? projects.find(({id}) => id === String(selection.projects[0]))
      : undefined;

  const selectProject = useCallback(
    (projectId: number) => {
      const availableEnvironments = getAvailableEnvironments(
        projects,
        new Set([projectId])
      );
      updateProjects([projectId], location, navigate, {
        replace: true,
        save: false,
        resetParams,
        environments: selection.environments.filter(environment =>
          availableEnvironments.has(environment)
        ),
      });
    },
    [location, navigate, projects, resetParams, selection.environments]
  );

  useEffect(() => {
    if (!isReady || selectedProject) {
      return;
    }
    const preselectedProject = findPreselectedProject(sortedProjects, [
      ...selection.projects,
      ...(getPageFilterStorage(organization.slug).state.project ?? []),
    ]);
    if (preselectedProject) {
      selectProject(Number(preselectedProject.id));
    }
  }, [
    isReady,
    organization.slug,
    selectProject,
    selectedProject,
    selection.projects,
    sortedProjects,
  ]);

  return (
    <CompactSelect
      search
      menuTitle={t('Project')}
      value={selectedProject?.id}
      options={sortedProjects.map(project => ({
        value: project.id,
        textValue: project.slug,
        label: <ProjectBadge project={project} avatarSize={16} disableLink />,
      }))}
      onChange={option => selectProject(Number(option.value))}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          icon={
            selectedProject ? (
              <ProjectAvatar project={selectedProject} size={16} />
            ) : undefined
          }
          prefix={t('Project')}
        >
          {selectedProject?.slug ?? t('None')}
        </OverlayTrigger.Button>
      )}
    />
  );
}
