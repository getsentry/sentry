import Reflux from 'reflux';

import {Project, Team} from 'app/types';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';

type State = {
  projects: Project[];
  loading: boolean;
};

type StatsData = Record<string, Project['stats']>;

/**
 * Attributes that need typing but aren't part of the external interface,
 */
type Internals = {
  itemsById: Record<string, Project>;
  loading: boolean;
};

type ProjectsStoreInterface = {
  init: () => void;
  reset: () => void;
  loadInitialData: (projects: Project[]) => void;
  onStatsLoadSuccess: (data: StatsData) => void;
  onChangeSlug: (prevSlug: string, newSlug: string) => void;
  onCreateSuccess: (project: Project) => void;
  onUpdateSuccess: (data: Partial<Project>) => void;
  onDeleteTeam: (slug: string) => void;
  onRemoveTeam: (teamSlug: string, projectSlug: string) => void;
  onAddTeam: (team: Team, projectSlug: string) => void;
  removeTeamFromProject: (teamSlug: string, project: Project) => void;
  getWithTeam: (teamSlug: string) => Project[];
  getAll: () => Project[];
  getBySlugs: (slug: string[]) => Project[];
  getState: (slugs?: string[]) => State;
  getById: (id?: string) => Project | undefined;
  getBySlug: (slug?: string) => Project | undefined;
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
    this.itemsById = items.reduce((map, project) => {
      map[project.id] = project;
      return map;
    }, {});
    this.loading = false;
    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onChangeSlug(prevSlug: string, newSlug: string) {
    const prevProject = this.getBySlug(prevSlug);

    // This shouldn't happen
    if (!prevProject) {
      return;
    }

    const newProject = {
      ...prevProject,
      slug: newSlug,
    };

    this.itemsById = {
      ...this.itemsById,
      [newProject.id]: newProject,
    };

    // Ideally we'd always trigger this.itemsById, but following existing patterns
    // so we don't break things
    this.trigger(new Set([prevProject.id]));
  },

  onCreateSuccess(project: Project) {
    this.itemsById = {
      ...this.itemsById,
      [project.id]: project,
    };
    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data: Partial<Project>) {
    const project = this.getById(data.id);
    if (!project) {
      return;
    }
    const newProject = Object.assign({}, project, data);
    this.itemsById = {
      ...this.itemsById,
      [project.id]: newProject,
    };
    this.trigger(new Set([data.id]));
  },

  onStatsLoadSuccess(data) {
    const touchedIds: string[] = [];
    Object.entries(data || {}).forEach(([projectId, stats]) => {
      if (projectId in this.itemsById) {
        this.itemsById[projectId].stats = stats;
        touchedIds.push(projectId);
      }
    });
    this.trigger(new Set(touchedIds));
  },

  /**
   * Listener for when a team is completely removed
   *
   * @param teamSlug Team Slug
   */
  onDeleteTeam(teamSlug: string) {
    // Look for team in all projects
    const projectIds = this.getWithTeam(teamSlug).map(projectWithTeam => {
      this.removeTeamFromProject(teamSlug, projectWithTeam);
      return projectWithTeam.id;
    });

    this.trigger(new Set([projectIds]));
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

    this.itemsById = {
      ...this.itemsById,
      [project.id]: {
        ...project,
        teams: [...project.teams, team],
      },
    };

    this.trigger(new Set([project.id]));
  },

  // Internal method, does not trigger
  removeTeamFromProject(teamSlug: string, project: Project) {
    const newTeams = project.teams.filter(({slug}) => slug !== teamSlug);

    this.itemsById = {
      ...this.itemsById,
      [project.id]: {
        ...project,
        teams: newTeams,
      },
    };
  },

  /**
   * Returns a list of projects that has the specified team
   *
   * @param {String} teamSlug Slug of team to find in projects
   */
  getWithTeam(teamSlug: string) {
    return this.getAll().filter(({teams}) => teams.find(({slug}) => slug === teamSlug));
  },

  getAll() {
    return Object.values(this.itemsById).sort((a: Project, b: Project) => {
      if (a.slug > b.slug) {
        return 1;
      }
      if (a.slug < b.slug) {
        return -1;
      }
      return 0;
    });
  },

  getById(id) {
    return this.getAll().find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(project => project.slug === slug);
  },

  getBySlugs(slugs: string[]) {
    return this.getAll().filter(project => slugs.includes(project.slug));
  },

  getState(slugs?: string[]): State {
    return {
      projects: slugs ? this.getBySlugs(slugs) : this.getAll(),
      loading: this.loading,
    };
  },
};

type ProjectsStore = Reflux.Store & ProjectsStoreInterface;

export default Reflux.createStore(storeConfig) as ProjectsStore;
