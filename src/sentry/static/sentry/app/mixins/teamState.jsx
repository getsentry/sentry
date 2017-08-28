import SentryTypes from '../proptypes';
import OrganizationState from './organizationState';

let TeamState = {
  mixins: [OrganizationState],

  contextTypes: {
    team: SentryTypes.Team.isRequired
  },

  getTeam() {
    return this.context.team;
  }
};

export default TeamState;
