/*** @jsx React.DOM */

var PropTypes = require("../proptypes");

var ProjectState = {
  contextTypes: {
    project: PropTypes.Project.isRequired,
  },

  getProject() {
    return this.context.project;
  }
};

module.exports = ProjectState;
