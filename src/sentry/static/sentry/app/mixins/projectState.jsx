var PropTypes = require("../proptypes");
var TeamState = require("./teamState");

var ProjectState = {
  mixins: [TeamState],

  contextTypes: {
    project: PropTypes.Project,
  },

  getProject() {
    return this.context.project;
  }
};

module.exports = ProjectState;
