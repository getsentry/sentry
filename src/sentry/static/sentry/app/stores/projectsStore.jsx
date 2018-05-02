import Reflux from 'reflux';
import _ from 'lodash';

import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';

const ProjectsStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(ProjectActions.createSuccess, this.onCreateSuccess);
    this.listenTo(ProjectActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(ProjectActions.loadStatsSuccess, this.onStatsLoadSuccess);
    this.listenTo(ProjectActions.changeSlug, this.onChangeSlug);
    this.listenTo(ProjectActions.addTeamSuccess, this.onAddTeam);
    this.listenTo(ProjectActions.removeTeamSuccess, this.onRemoveTeam);
    this.listenTo(TeamActions.removeTeamSuccess, this.onDeleteTeam);
  },

  reset() {
    this.itemsById = {};
  },

  loadInitialData(items) {
    this.itemsById = items.reduce((map, project) => {
      map[project.id] = project;
      return map;
    }, {});
    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onChangeSlug(prevSlug, newSlug) {
    let prevProject = this.getBySlug(prevSlug);

    // This shouldn't happen
    if (!prevProject) return;

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

  onCreateSuccess(project) {
    this.itemsById = {
      ...this.itemsById,
      [project.id]: project,
    };
    this.trigger(new Set([project.id]));
  },

  onUpdateSuccess(data) {
    let project = this.getById(data.id);
    let newProject = Object.assign({}, project, data);
    this.itemsById = {
      ...this.itemsById,
      [project.id]: newProject,
    };
    this.trigger(new Set([data.id]));
  },

  onStatsLoadSuccess(data) {
    let touchedIds = [];
    _.each(data || [], (stats, projectId) => {
      if (projectId in this.itemsById) {
        this.itemsById[projectId].stats = stats;
        touchedIds.push(projectId);
      }
    });
    this.trigger(new Set(touchedIds));
  },

  /**
   * Listener for when a team is completely removed
   * @param {String} teamSlug Team Slug
   */
  onDeleteTeam(teamSlug) {
    // Look for team in all projects
    let projectIds = this.getWithTeam(teamSlug).map(projectWithTeam => {
      this.removeTeamFromProject(teamSlug, projectWithTeam);
      return projectWithTeam.id;
    });

    this.trigger(new Set([projectIds]));
  },

  onRemoveTeam(teamSlug, projectSlug) {
    let project = this.getBySlug(projectSlug);
    if (!project) return;

    this.removeTeamFromProject(teamSlug, project);
    this.trigger(new Set([project.id]));
  },

  onAddTeam(team, projectSlug) {
    let project = this.getBySlug(projectSlug);

    // Don't do anything if we can't find a project
    if (!project) return;

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
  removeTeamFromProject(teamSlug, project) {
    let newTeams = project.teams.filter(({slug}) => slug !== teamSlug);

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
  getWithTeam(teamSlug) {
    return this.getAll().filter(({teams}) => teams.find(({slug}) => slug === teamSlug));
  },

  getAll() {
    return Object.values(this.itemsById).sort((a, b) => {
      if (a.slug > b.slug) return 1;
      if (a.slug < b.slug) return -1;
      return 0;
    });
  },

  getAllGroupedByOrganization() {
    return this.getAll().reduce((acc, project) => {
      const orgSlug = project.organization.slug;
      if (acc[orgSlug]) {
        acc[orgSlug].projects.push(project);
      } else {
        acc[orgSlug] = {
          organization: project.organization,
          projects: [project],
        };
      }
      return acc;
    }, {});
  },

  getById(id) {
    return this.getAll().find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(project => project.slug === slug);
  },
});

export default ProjectsStore;
