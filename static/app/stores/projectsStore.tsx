import Reflux from 'reflux';

import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import {Project, Team} from 'app/types';

import {CommonStoreInterface} from './types';

type State = {
  projects: Project[];
  loading: boolean;
};

type StatsData = Record<string, Project['stats']>;

/**
 * Attributes that need typing but aren't part of the external interface,
 */
type Internals = {
  removeTeamFromProject(teamSlug: string, project: Project): void;
  itemsById: Record<string, Project>;
  loading: boolean;
};

type ProjectsStoreInterface = CommonStoreInterface<State> & {
  init(): void;
  reset(): void;
  loadInitialData(projects: Project[]): void;
  onStatsLoadSuccess(data: StatsData): void;
  onChangeSlug(prevSlug: string, newSlug: string): void;
  onCreateSuccess(project: Project): void;
  onUpdateSuccess(data: Partial<Project>): void;
  onDeleteTeam(slug: string): void;
  onRemoveTeam(teamSlug: string, projectSlug: string): void;
  onAddTeam(team: Team, projectSlug: string): void;
  isLoading(): boolean;
  getAll(): Project[];
  getById(id?: string): Project | undefined;
  getBySlug(slug?: string): Project | undefined;
};

const storeConfig: Reflux.StoreDefinition & Internals & ProjectsStoreInterface = {
  itemsById: {},
  loading: true,

  init() {
    this.reset();

    this.listenTo(ProjectActions.addTeamSuccess, this.onAddTeam);
    this.listenTo(ProjectActions.changeSlug, this.onChangeSlug);
    this.listenTo(ProjectActions.createSuccess, this.onCreateSuccess);
    this.listenTo(ProjectActions.loadProjects, this.loadInitialData);
    this.listenTo(ProjectActions.loadStatsSuccess, this.onStatsLoadSuccess);
    this.listenTo(ProjectActions.removeTeamSuccess, this.onRemoveTeam);
    this.listenTo(ProjectActions.reset, this.reset);
    this.listenTo(ProjectActions.updateSuccess, this.onUpdateSuccess);

    this.listenTo(TeamActions.removeTeamSuccess, this.onDeleteTeam);
  },

  reset() {
    this.itemsById = {};
    this.loading = true;
  },

  loadInitialData(items: Project[]) {
    const mapping = items.map(project => [project.id, project] as const);

    this.itemsById = Object.fromEntries(mapping);
    this.loading = false;

    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onChangeSlug(prevSlug: string, newSlug: string) {
    const prevProject = this.getBySlug(prevSlug);

    if (!prevProject) {
      return;
    }

    const newProject = {...prevProject, slug: newSlug};

    this.itemsById = {...this.itemsById, [newProject.id]: newProject};
    this.trigger(new Set([prevProject.id]));
  },

  onCreateSuccess(project: Project) {
    this.itemsById = {...this.itemsById, [project.id]: project};
    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data: Partial<Project>) {
    const project = this.getById(data.id);

    if (!project) {
      return;
    }

    const newProject = {...project, ...data};

    this.itemsById = {...this.itemsById, [project.id]: newProject};
    this.trigger(new Set([data.id]));
  },

  onStatsLoadSuccess(data) {
    const entries = Object.entries(data || {}).filter(
      ([projectId]) => projectId in this.itemsById
    );

    // Assign stats into projects
    entries.forEach(([projectId, stats]) => {
      this.itemsById[projectId].stats = stats;
    });

    const touchedIds = entries.map(([projectId]) => projectId);
    this.trigger(new Set(touchedIds));
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string) {
    // Look for team in all projects
    const projects = this.getAll().filter(({teams}) =>
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

    this.itemsById = {...this.itemsById, [project.id]: newProject};
    this.trigger(new Set([project.id]));
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug: string, project: Project) {
    const newTeams = project.teams.filter(({slug}) => slug !== teamSlug);
    const newProject = {...project, teams: newTeams};

    this.itemsById = {...this.itemsById, [project.id]: newProject};
  },

  isLoading() {
    return this.loading;
  },

  getAll() {
    return Object.values(this.itemsById).sort((a, b) => a.slug.localeCompare(b.slug));
  },

  getById(id) {
    return this.getAll().find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(project => project.slug === slug);
  },

  getState() {
    return {
      projects: this.getAll(),
      loading: this.loading,
    };
  },
};

const ProjectsStore = Reflux.createStore(storeConfig) as Reflux.Store &
  ProjectsStoreInterface;

export default ProjectsStore;
