import Reflux from 'reflux';
import TeamActions from '../actions/teamActions';
import ProjectsStore from './projectsStore';

const TeamStore = Reflux.createStore({
  init() {
    this.initialized = false;
    this.reset();

    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(ProjectsStore, this.onProject);
  },

  reset() {
    this.items = [];
    // TODO(jess): this is not going to make sense/be accurate in sentry 9
    this.projectMap = {}; // map of project ids => team ids
  },

  loadInitialData(items) {
    items.forEach(item => {
      item.projects.forEach(project => {
        this.projectMap[project.id] = item.id;
      });
    });
    this.initialized = true;
    this.items = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  onUpdateSuccess(changeId, itemId, response) {
    if (!response) return;

    let item = this.getBySlug(itemId);

    if (!item) {
      this.items.push(response);
    } else {
      // Slug was changed
      // Note: This is the proper way to handle slug changes but unfortunately not all of our
      // components use stores correctly. To be safe reload browser :((
      if (response.slug !== itemId) {
        // Remove old team
        this.items = this.items.filter(({slug}) => slug !== itemId);
        // Add team w/ updated slug
        this.items.push(response);
        this.trigger(new Set([response.slug]));
        return;
      }

      $.extend(true /*deep*/, item, response);
    }

    this.trigger(new Set([itemId]));
  },

  onProject(projectIds) {
    let teamsChanged = new Set();

    projectIds.forEach((set, projectId) => {
      let teamId = this.projectMap[projectId];
      if (teamId === undefined) return;
      let team = this.getById(teamId);
      // TODO: make copy of project? right now just assigning reference
      // to project form project store
      let project = ProjectsStore.getById(projectId);
      // so gross don't look, update projects in
      // the team.projects list. this should be behavior
      // we can completely deprecate after sentry 9
      team.projects = team.projects.filter(p => {
        return p.slug !== project.slug;
      });
      team.projects.push(project);
      teamsChanged.add(team.id);
    });
    this.trigger(teamsChanged);
  },

  getById(id) {
    return this.items.find(item => item.id.toString() === id.toString()) || null;
  },

  getBySlug(slug) {
    return this.items.find(item => item.slug === slug) || null;
  },

  getActive() {
    return this.items.filter(item => item.isMember);
  },

  getAll() {
    return this.items;
  },
});

window.TeamStore = TeamStore;

export default TeamStore;
