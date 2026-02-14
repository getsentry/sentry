import {createStore} from 'reflux';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {Client} from 'sentry/api';
import {clearQueryCache} from 'sentry/appQueryClient';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import type {StrictStoreDefinition} from './types';

type State = {
  loading: boolean;
  projects: Project[];
};

type StatsData = Record<string, Project['stats']>;

/**
 * Attributes that need typing but aren't part of the external interface,
 */
type InternalDefinition = {
  api: Client;
  removeTeamFromProject(teamSlug: string, project: Project): void;
};

interface ProjectsStoreDefinition
  extends InternalDefinition, StrictStoreDefinition<State> {
  getById(id?: string): Project | undefined;
  getBySlug(slug?: string): Project | undefined;
  isLoading(): boolean;
  loadInitialData(projects: Project[]): void;
  onAddTeam(team: Team, projectSlug: string): void;
  onChangeSlug(prevSlug: string, newSlug: string): void;
  onCreateSuccess(project: Project, orgSlug: string): void;
  onDeleteProject(projectSlug: string): void;
  onDeleteTeam(slug: string): void;
  onRemoveTeam(teamSlug: string, projectSlug: string): void;
  onStatsLoadSuccess(data: StatsData): void;
  onUpdateSuccess(data: Partial<Project>): void;
  reset(): void;
}

const storeConfig: ProjectsStoreDefinition = {
  api: new Client(),
  state: {
    projects: [],
    loading: true,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      projects: [],
      loading: true,
    };
  },

  loadInitialData(items: Project[]) {
    this.state = {
      projects: items.toSorted((a: any, b: any) => a.slug.localeCompare(b.slug)),
      loading: false,
    };

    this.trigger(new Set(items.map(x => x.id)));
  },

  onChangeSlug(prevSlug: string, newSlug: string) {
    const prevProject = this.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = {...prevProject, slug: newSlug};
    const newProjects = this.state.projects
      .map(project => (project.slug === prevSlug ? newProject : project))
      .toSorted((a: any, b: any) => a.slug.localeCompare(b.slug));
    this.state = {...this.state, projects: newProjects};

    this.trigger(new Set([prevProject.id]));
    clearQueryCache();
  },

  onCreateSuccess(project: Project, orgSlug: string) {
    const newProjects = this.state.projects
      .concat([project])
      .sort((a, b) => a.slug.localeCompare(b.slug));
    this.state = {...this.state, projects: newProjects};

    // Reload organization details since we've created a new project
    fetchOrganizationDetails(this.api, orgSlug);
    clearQueryCache();

    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data: Partial<Project>) {
    const project = this.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = {...project, ...data};
    const newProjects = this.state.projects.map(p =>
      p.id === project.id ? newProject : p
    );
    this.state = {...this.state, projects: newProjects};

    this.trigger(new Set([data.id]));
    clearQueryCache();
  },

  onStatsLoadSuccess(data) {
    const statsData = data || {};

    // Assign stats into projects
    const newProjects = this.state.projects.map(project =>
      statsData[project.id] ? {...project, stats: data[project.id]} : project
    );
    this.state = {...this.state, projects: newProjects};

    this.trigger(new Set(Object.keys(data)));
  },

  onDeleteProject(projectSlug: string) {
    const project = this.getBySlug(projectSlug);
    if (!project) {
      return;
    }
    const newProjects = this.state.projects.filter(p => p.id !== project.id);
    this.state = {...this.state, projects: newProjects};
    this.trigger(new Set([project.id]));
    clearQueryCache();
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string) {
    // Look for team in all projects
    const projects = this.state.projects.filter(({teams}) =>
      teams.find(({slug}) => slug === teamSlug)
    );

    projects.forEach(project => this.removeTeamFromProject(teamSlug, project));

    const affectedProjectIds = projects.map(project => project.id);
    this.trigger(new Set(affectedProjectIds));
    clearQueryCache();
  },

  onRemoveTeam(teamSlug: string, projectSlug: string) {
    const project = this.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    this.removeTeamFromProject(teamSlug, project);
    this.trigger(new Set([project.id]));
    clearQueryCache();
  },

  onAddTeam(team: Team, projectSlug: string) {
    const project = this.getBySlug(projectSlug);

    // Don't do anything if we can't find a project
    if (!project) {
      return;
    }

    const newProject = {...project, teams: [...project.teams, team]};
    const newProjects = this.state.projects.map(p =>
      p.id === project.id ? newProject : p
    );
    this.state = {...this.state, projects: newProjects};

    this.trigger(new Set([project.id]));
    clearQueryCache();
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug: string, project: Project) {
    const newTeams = project.teams.filter(({slug}) => slug !== teamSlug);
    const newProject = {...project, teams: newTeams};
    const newProjects = this.state.projects.map(p =>
      p.id === project.id ? newProject : p
    );
    this.state = {...this.state, projects: newProjects};
    clearQueryCache();
  },

  isLoading() {
    return this.state.loading;
  },

  getById(id) {
    return this.state.projects.find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.state.projects.find(project => project.slug === slug);
  },

  getState() {
    return this.state;
  },
};

const ProjectsStore = createStore(storeConfig);
export default ProjectsStore;
