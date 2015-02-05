/*** @jsx React.DOM */

var PropTypes = require("../proptypes");

var TeamState = {
  contextTypes: {
    team: PropTypes.Team.isRequired,
  },

  getTeam() {
    return this.context.team;
  }
};

module.exports = TeamState;
