import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

/**
 * How the page-filter project selector is currently set for the agent.
 *
 * - `explicit` — one or more concrete projects are pinned.
 * - `my-projects` — empty selection (member projects / default org scope).
 * - `all-projects` — the all-access sentinel (-1).
 *
 * My/All modes deliberately keep `projectIds`/`projectSlugs` empty. Expanding
 * membership into dozens of slugs confuses the agent into treating that list
 * as a hard multi-project pin. Use `instruction` for the agent-facing guidance.
 */
export type ProjectSelectionMode = 'explicit' | 'my-projects' | 'all-projects';

export type SelectedProjectsForLLMContext = {
  instruction: string;
  /**
   * True only for the All Projects sentinel. My Projects is a member subset, so
   * it is `false` even though ids/slugs stay empty — use `selectionMode`.
   */
  isAllProjects: boolean;
  projectIds: string[];
  projectSlugs: string[];
  projects: Array<{id: string; slug: string}>;
  selectionMode: ProjectSelectionMode;
};

const MY_PROJECTS_INSTRUCTION =
  'Page filter is My Projects: no hard single-project pin. Scope queries to projects the user is a member of (org default). Empty projectIds/projectSlugs is expected — not missing data. Do not invent a specific project slug unless the user names one.';

const ALL_PROJECTS_INSTRUCTION =
  'Page filter is All Projects: query org-wide across every project the user can access. Empty projectIds/projectSlugs is expected — not missing data. Do not invent a specific project slug unless the user names one.';

function explicitProjectsInstruction(
  projects: Array<{id: string; slug: string}>
): string {
  const list = projects.map(project => `${project.slug} (id: ${project.id})`).join(', ');
  return `Page filter pins these projects — scope queries to them unless the user asks otherwise: ${list}.`;
}

export function getSelectedProjectsForLLMContext(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
): SelectedProjectsForLLMContext {
  if (selectedProjects.includes(ALL_ACCESS_PROJECTS)) {
    return {
      selectionMode: 'all-projects',
      isAllProjects: true,
      projectIds: [],
      projectSlugs: [],
      projects: [],
      instruction: ALL_PROJECTS_INSTRUCTION,
    };
  }

  // Empty URL/selection is My Projects (member projects), not All Projects.
  if (selectedProjects.length === 0) {
    return {
      selectionMode: 'my-projects',
      isAllProjects: false,
      projectIds: [],
      projectSlugs: [],
      projects: [],
      instruction: MY_PROJECTS_INSTRUCTION,
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
    selectionMode: 'explicit',
    isAllProjects: false,
    projectIds: resolved.map(project => project.id),
    projectSlugs: resolved.map(project => project.slug),
    projects: resolved,
    instruction: explicitProjectsInstruction(resolved),
  };
}

/**
 * Flat fields every page-level `useLLMContext` call should spread so Issues /
 * Explore / Dashboards report the same project-selection shape — including an
 * explicit instruction when My/All Projects leaves the id/slug lists empty.
 */
export function toLLMContextProjectFields(selected: SelectedProjectsForLLMContext): {
  isAllProjects: boolean;
  projectIds: string[];
  projectSelectionInstruction: string;
  projectSelectionMode: ProjectSelectionMode;
  projectSlugs: string[];
} {
  return {
    projectIds: selected.projectIds,
    projectSlugs: selected.projectSlugs,
    isAllProjects: selected.isAllProjects,
    projectSelectionMode: selected.selectionMode,
    projectSelectionInstruction: selected.instruction,
  };
}

/**
 * Hook form of {@link getSelectedProjectsForLLMContext} for page-level
 * `useLLMContext` call sites.
 */
export function useSelectedProjectsForLLMContext(): SelectedProjectsForLLMContext {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(
    () => getSelectedProjectsForLLMContext(selection.projects, projects),
    [selection.projects, projects]
  );
}
