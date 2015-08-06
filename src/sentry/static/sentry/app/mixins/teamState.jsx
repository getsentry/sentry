import PropTypes from "../proptypes";
import OrganizationState from "./organizationState";

var TeamState = {
  mixins: [OrganizationState],

  contextTypes: {
    team: PropTypes.Team.isRequired,
  },

  getTeam() {
    return this.context.team;
  }
};

export default TeamState;

