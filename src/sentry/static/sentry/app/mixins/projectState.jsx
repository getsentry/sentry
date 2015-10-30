import PropTypes from '../proptypes';
import TeamState from './teamState';

let ProjectState = {
  mixins: [TeamState],

  contextTypes: {
    project: PropTypes.Project,
  },

  getProjectFeatures() {
    return new Set(this.context.project.features);
  },

  getProject() {
    return this.context.project;
  }
};

export default ProjectState;

