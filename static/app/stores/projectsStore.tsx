import {Store} from '@tanstack/react-store';

import {clearQueryCache} from 'sentry/appQueryClient';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type State = {
  loading: boolean;
  projects: Project[];
};

const store = new Store<State>({projects: [], loading: true});

function setProjects(projects: Project[]) {
  store.setState(prev => ({...prev, projects}));
}

// Internal helper, the caller clears the query cache
function removeTeamFromProject(teamSlug: string, project: Project) {
  const newTeams = project.teams.filter(({slug}) => slug !== teamSlug);
  const newProject = {...project, teams: newTeams};
  setProjects(store.state.projects.map(p => (p.id === project.id ? newProject : p)));
  clearQueryCache();
}

export const ProjectsStore = {
  store,

  getState() {
    return store.state;
  },

  init() {
    ProjectsStore.reset();
  },

  reset() {
    store.setState(() => ({projects: [], loading: true}));
  },

  loadInitialData(items: Project[]) {
    store.setState(() => ({
      projects: items.toSorted((a, b) => a.slug.localeCompare(b.slug)),
      loading: false,
    }));
  },

  onChangeSlug(prevSlug: string, newSlug: string) {
    const prevProject = ProjectsStore.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = {...prevProject, slug: newSlug};
    setProjects(
      store.state.projects
        .map(project => (project.slug === prevSlug ? newProject : project))
        .toSorted((a, b) => a.slug.localeCompare(b.slug))
    );
    clearQueryCache();
  },

  onCreateSuccess(project: Project) {
    setProjects(
      store.state.projects.concat([project]).sort((a, b) => a.slug.localeCompare(b.slug))
    );
    clearQueryCache();
  },

  onUpdateSuccess(data: Partial<Project>) {
    const project = ProjectsStore.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = {...project, ...data};
    setProjects(store.state.projects.map(p => (p.id === project.id ? newProject : p)));
    clearQueryCache();
  },

  onDeleteProject(projectSlug: string) {
    const project = ProjectsStore.getBySlug(projectSlug);
    if (!project) {
      return;
    }
    setProjects(store.state.projects.filter(p => p.id !== project.id));
    clearQueryCache();
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string) {
    // Look for team in all projects
    const projects = store.state.projects.filter(({teams}) =>
      teams.find(({slug}) => slug === teamSlug)
    );

    projects.forEach(project => removeTeamFromProject(teamSlug, project));
    clearQueryCache();
  },

  onRemoveTeam(teamSlug: string, projectSlug: string) {
    const project = ProjectsStore.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    removeTeamFromProject(teamSlug, project);
    clearQueryCache();
  },

  onAddTeam(team: Team, projectSlug: string) {
    const project = ProjectsStore.getBySlug(projectSlug);

    // Don't do anything if we can't find a project
    if (!project) {
      return;
    }

    const newProject = {...project, teams: [...project.teams, team]};
    setProjects(store.state.projects.map(p => (p.id === project.id ? newProject : p)));
    clearQueryCache();
  },

  isLoading() {
    return store.state.loading;
  },

  getById(id?: string) {
    return store.state.projects.find(project => project.id === id);
  },

  getBySlug(slug?: string) {
    return store.state.projects.find(project => project.slug === slug);
  },
};
