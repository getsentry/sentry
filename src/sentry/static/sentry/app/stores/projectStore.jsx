import Reflux from 'reflux';
import ProjectActions from '../actions/projectActions';

const ProjectStore = Reflux.createStore({
  init() {
    this.items = [];

    this.listenTo(ProjectActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.items = [];
  },

  loadInitialData(items) {
    this.items = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  onUpdateSuccess(data) {
    let project = this.getById(data.id);
    Object.assign(project, data);
    this.trigger(new Set(data.id));
  },

  getAll() {
    return this.items;
  },

  getById(id) {
    return this.items.find(project => project.id === id);
  }
});

export default ProjectStore;

