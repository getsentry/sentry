var PropTypes = require("../proptypes");
var ProjectState = require("./projectState");

var GroupState = {
  mixins: [ProjectState],

  contextTypes: {
    group: PropTypes.Group.isRequired,
  },

  getGroup() {
    return this.context.group;
  }
};

module.exports = GroupState;
