import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

/**
 * Selected page-filter projects as the agent should see them.
 *
 * - Explicit selection → concrete `{id, slug}` pairs for those projects.
 * - Empty selection ("My Projects") or the all-access sentinel → empty list
 *   plus `isAllProjects: true`. Expanding membership into dozens of slugs
 *   confuses the agent into treating "my projects" as a hard multi-project
 *   filter; the empty list + flag is the unambiguous signal.
 */
export type SelectedProjectsForLLMContext = {
  isAllProjects: boolean;
  projectIds: string[];
  projectSlugs: string[];
  projects: Array<{id: string; slug: string}>;
};

export function getSelectedProjectsForLLMContext(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
): SelectedProjectsForLLMContext {
  if (
    selectedProjects.length === 0 ||
    selectedProjects.includes(ALL_ACCESS_PROJECTS)
  ) {
    return {
      isAllProjects: true,
      projectIds: [],
      projectSlugs: [],
      projects: [],
    };
  }

  const projectsById = new Map(projects.map(project => [Number(project.id), project]));
  const resolved: Array<{id: string; slug: string}> = [];

  for (const projectId of selectedProjects) {
    const project = projectsById.get(Number(projectId));
    if (project) {
      resolved.push({id: project.id, slug: project.slug});
    }
  }

  return {
    isAllProjects: false,
    projectIds: resolved.map(project => project.id),
    projectSlugs: resolved.map(project => project.slug),
    projects: resolved,
  };
}

/**
 * Hook form of {@link getSelectedProjectsForLLMContext} for page-level
 * `useLLMContext` call sites. Prefer this over ad-hoc page-filter mapping so
 * Issues / Explore / Dashboards all report the same shape.
 */
export function useSelectedProjectsForLLMContext(): SelectedProjectsForLLMContext {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(
    () => getSelectedProjectsForLLMContext(selection.projects, projects),
    [selection.projects, projects]
  );
}
