import Reflux from 'reflux';
import _ from 'underscore';

import ProjectActions from '../actions/projectActions';

const ProjectStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(ProjectActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(ProjectActions.loadStatsSuccess, this.onStatsLoadSuccess);
  },

  reset() {
    this.items = [];
    this.itemsById = {};
  },

  loadInitialData(items) {
    this.items = items;
    this.itemsById = this.items.reduce((map, project) => {
      map[project.id] = project;
      return map;
    }, {});
    this.trigger(new Set(Object.keys(this.itemsById)));
  },

  onUpdateSuccess(data) {
    let project = this.getById(data.id);
    Object.assign(project, data);
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

  getAll() {
    return this.items;
  },

  getById(id) {
    return this.items.find(project => project.id === id);
  },

  getBySlug(slug) {
    return this.items.find(project => project.slug === slug);
  }
});

export default ProjectStore;

