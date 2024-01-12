import {createStore} from 'reflux';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {Client} from 'sentry/api';
import {Project, Team} from 'sentry/types';

import LatestContextStore from './latestContextStore';
import {CommonStoreDefinition} from './types';

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
  loading: boolean;
  projects: Project[];
  removeTeamFromProject(teamSlug: string, project: Project): void;
};

interface ProjectsStoreDefinition
  extends InternalDefinition,
    CommonStoreDefinition<State> {
  getById(id?: string): Project | undefined;
  getBySlug(slug?: string): Project | undefined;
  init(): void;
  isLoading(): boolean;
  loadInitialData(projects: Project[]): void;
  onAddTeam(team: Team, projectSlug: string): void;
  onChangeSlug(prevSlug: string, newSlug: string): void;
  onCreateSuccess(project: Project, orgSlug: string): void;
  onDeleteTeam(slug: string): void;
  onRemoveTeam(teamSlug: string, projectSlug: string): void;
  onStatsLoadSuccess(data: StatsData): void;
  onUpdateSuccess(data: Partial<Project>): void;
  reset(): void;
}

const storeConfig: ProjectsStoreDefinition = {
  api: new Client(),

  projects: [],
  loading: true,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.projects = [];
    this.itemsById = {};
    this.loading = true;
  },

  loadInitialData(items: Project[]) {
    this.projects = items.toSorted((a, b) => a.slug.localeCompare(b.slug));
    this.loading = false;

    this.trigger(new Set(items.map(x => x.id)));
  },

  onChangeSlug(prevSlug: string, newSlug: string) {
    const prevProject = this.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = {...prevProject, slug: newSlug};
    this.projects = this.projects
      .map(project => (project.slug === prevSlug ? newProject : project))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    this.trigger(new Set([prevProject.id]));
  },

  onCreateSuccess(project: Project, orgSlug: string) {
    this.projects = this.projects
      .concat([project])
      .sort((a, b) => a.slug.localeCompare(b.slug));

    // Reload organization details since we've created a new project
    fetchOrganizationDetails(this.api, orgSlug, true, false);

    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data: Partial<Project>) {
    const project = this.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = {...project, ...data};
    this.projects = this.projects.map(p => (p.id === project.id ? newProject : p));

    this.trigger(new Set([data.id]));

    LatestContextStore.onUpdateProject(newProject);
  },

  onStatsLoadSuccess(data) {
    const statsData = data || {};

    // Assign stats into projects
    this.projects = this.projects.map(project =>
      statsData[project.id] ? {...project, stats: data[project.id]} : project
    );

    this.trigger(new Set(Object.keys(data)));
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string) {
    // Look for team in all projects
    const projects = this.projects.filter(({teams}) =>
      teams.find(({slug}) => slug === teamSlug)
    );

    projects.forEach(project => this.removeTeamFromProject(teamSlug, project));

    const affectedProjectIds = projects.map(project => project.id);
    this.trigger(new Set(affectedProjectIds));
  },

  onRemoveTeam(teamSlug: string, projectSlug: string) {
    const project = this.getBySlug(projectSlug);

    if (!project) {
      return;
    }

    this.removeTeamFromProject(teamSlug, project);
    this.trigger(new Set([project.id]));
  },

  onAddTeam(team: Team, projectSlug: string) {
    const project = this.getBySlug(projectSlug);

    // Don't do anything if we can't find a project
    if (!project) {
      return;
    }

    const newProject = {...project, teams: [...project.teams, team]};
    this.projects = this.projects.map(p => (p.id === project.id ? newProject : p));

    this.trigger(new Set([project.id]));
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug: string, project: Project) {
    const newTeams = project.teams.filter(({slug}) => slug !== teamSlug);
    const newProject = {...project, teams: newTeams};
    this.projects = this.projects.map(p => (p.id === project.id ? newProject : p));
  },

  isLoading() {
    return this.loading;
  },

  getById(id) {
    return this.projects.find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.projects.find(project => project.slug === slug);
  },

  getState() {
    return {
      projects: this.projects,
      loading: this.loading,
    };
  },
};

const ProjectsStore = createStore(storeConfig);
export default ProjectsStore;
