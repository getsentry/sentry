var PropTypes = require("../proptypes");
var OrganizationState = require("./organizationState");

var TeamState = {
  mixins: [OrganizationState],

  contextTypes: {
    team: PropTypes.Team.isRequired,
  },

  getTeam() {
    return this.context.team;
  }
};

module.exports = TeamState;
