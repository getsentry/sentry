import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {Project} from 'sentry/types';
import {PageFilters} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

function getSelectedProjectList(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
) {
  if (selectedProjects[0] === ALL_ACCESS_PROJECTS || selectedProjects.length === 0) {
    return projects;
  }

  const projectsByProjectId = projects.reduce<Record<string, Project>>((acc, project) => {
    acc[project.id] = project;
    return acc;
  }, {});
  return selectedProjects.map(id => projectsByProjectId[id]).filter(Boolean);
}

export function useHasOrganizationSetupFeedback() {
  const {projects, fetching} = useProjects();
  const hasOrgSetupFeedback = useMemo(
    () => projects.some(p => p.hasFeedbacks),
    [projects]
  );
  return {hasOrgSetupFeedback, fetching};
}

export function useHaveSelectedProjectsSetupFeedback() {
  const {projects, fetching} = useProjects();
  const {selection} = usePageFilters();

  const orgSetupOneOrMoreFeedback = useMemo(() => {
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    const hasSetupOneFeedback = selectedProjects.some(project => project.hasFeedbacks);
    return hasSetupOneFeedback;
  }, [selection.projects, projects]);

  return {
    hasSetupOneFeedback: orgSetupOneOrMoreFeedback,
    fetching,
  };
}
