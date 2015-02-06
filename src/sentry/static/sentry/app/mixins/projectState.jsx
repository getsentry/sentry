/*** @jsx React.DOM */

var PropTypes = require("../proptypes");
var TeamState = require("./teamState");

var ProjectState = {
  mixins: [TeamState],

  contextTypes: {
    project: PropTypes.Project.isRequired,
  },

  getProject() {
    return this.context.project;
  }
};

module.exports = ProjectState;
