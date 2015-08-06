import PropTypes from "../proptypes";
import TeamState from "./teamState";

var ProjectState = {
  mixins: [TeamState],

  contextTypes: {
    project: PropTypes.Project,
  },

  getProject() {
    return this.context.project;
  }
};

export default ProjectState;

