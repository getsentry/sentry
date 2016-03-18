import Reflux from 'reflux';
import TeamActions from '../actions/teamActions';
import ProjectStore from './projectStore';

const TeamStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(ProjectStore, this.onProject);
  },

  reset() {
    this.items = [];
    this.projectMap = {}; // map of project ids => team ids
  },

  loadInitialData(items) {
    items.forEach(item => {
      item.projects.forEach(project => {
        this.projectMap[project.id] = item.id;
      });
    });
    this.items = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  onUpdateSuccess(changeId, itemId, response) {
    if (!response)
      return;

    let item = this.getBySlug(itemId);
    if (!item) {
      this.items.push(response);
    } else {
      $.extend(true /*deep*/, item, response);
    }

    this.trigger(new Set([itemId]));
  },

  onProject(projectIds) {
    let teamsChanged = new Set();
    projectIds.forEach((set, projectId) => {
      let teamId = this.projectMap[projectId];
      let team = this.getById(teamId);

      // TODO: make copy of project? right now just assigning reference
      // to project form project store
      let project = ProjectStore.getById(projectId);
      team.project = project;
      teamsChanged.add(team.id);
    });
    this.trigger(teamsChanged);
  },

  getById(id) {
    return this.items.find(item => item.id === '' + id) || null;
  },

  getBySlug(slug) {
    return this.items.find(item => item.slug === slug) || null;
  },

  getActive() {
    return this.items.filter((item) => item.isMember);
  },

  getAll() {
    return this.items;
  }
});

window.TeamStore = TeamStore;

export default TeamStore;

