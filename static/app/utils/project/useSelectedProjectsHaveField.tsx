import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

export function getSelectedProjectList(
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
  return selectedProjects
    .map(id => projectsByProjectId[id])
    .filter((project): project is Project => !!project);
}

export default function useSelectedProjectsHaveField(field: keyof Project) {
  const {projects, fetching} = useProjects();
  const {selection} = usePageFilters();

  const hasField = useMemo(() => {
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    const hasSetupOneFeedback = selectedProjects.some(project => project[field]);
    return hasSetupOneFeedback;
  }, [field, selection.projects, projects]);

  return {
    hasField,
    fetching,
  };
}
