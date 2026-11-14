import {createStore} from 'zustand/vanilla';

import {clearQueryCache} from 'sentry/appQueryClient';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface ProjectsState {
  readonly loading: boolean;
  readonly projects: Project[];
}

const initialState: ProjectsState = {
  projects: [],
  loading: true,
};

const store = createStore<ProjectsState>()(() => initialState);

function sortBySlug(projects: readonly Project[]): Project[] {
  return projects.toSorted((a, b) => a.slug.localeCompare(b.slug));
}

function withoutTeam(project: Project, teamSlug: string): Project {
  return {...project, teams: project.teams.filter(({slug}) => slug !== teamSlug)};
}

export const ProjectsStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Same as reset(). Kept for the tests that call it.
   */
  init(): void {
    ProjectsStore.reset();
  },

  reset(): void {
    store.setState(initialState, true);
  },

  loadInitialData(items: readonly Project[]): void {
    store.setState({projects: sortBySlug(items), loading: false}, true);
  },

  onChangeSlug(prevSlug: string, newSlug: string): void {
    const prevProject = ProjectsStore.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = {...prevProject, slug: newSlug};
    store.setState(state => ({
      projects: sortBySlug(
        state.projects.map(project => (project.slug === prevSlug ? newProject : project))
      ),
    }));
    clearQueryCache();
  },

  onCreateSuccess(project: Project): void {
    store.setState(state => ({projects: sortBySlug([...state.projects, project])}));
    clearQueryCache();
  },

  onUpdateSuccess(data: Partial<Project> & Pick<Project, 'id'>): void {
    const project = ProjectsStore.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = {...project, ...data};
    store.setState(state => ({
      projects: state.projects.map(p => (p.id === project.id ? newProject : p)),
    }));
    clearQueryCache();
  },

  onDeleteProject(projectSlug: string): void {
    const project = ProjectsStore.getBySlug(projectSlug);
    if (!project) {
      return;
    }
    store.setState(state => ({
      projects: state.projects.filter(p => p.id !== project.id),
    }));
    clearQueryCache();
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string): void {
    store.setState(state => ({
      projects: state.projects.map(project =>
        project.teams.some(({slug}) => slug === teamSlug)
          ? withoutTeam(project, teamSlug)
          : project
      ),
    }));
    clearQueryCache();
  },

  onRemoveTeam(teamSlug: string, projectSlug: string): void {
    const project = ProjectsStore.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    store.setState(state => ({
      projects: state.projects.map(p =>
        p.id === project.id ? withoutTeam(project, teamSlug) : p
      ),
    }));
    clearQueryCache();
  },

  onAddTeam(team: Team, projectSlug: string): void {
    const project = ProjectsStore.getBySlug(projectSlug);

    // Don't do anything if we can't find a project
    if (!project) {
      return;
    }

    const newProject = {...project, teams: [...project.teams, team]};
    store.setState(state => ({
      projects: state.projects.map(p => (p.id === project.id ? newProject : p)),
    }));
    clearQueryCache();
  },

  isLoading(): boolean {
    return store.getState().loading;
  },

  getById(id: string): Project | undefined {
    return store.getState().projects.find(project => project.id === id);
  },

  getBySlug(slug: string): Project | undefined {
    return store.getState().projects.find(project => project.slug === slug);
  },
};
