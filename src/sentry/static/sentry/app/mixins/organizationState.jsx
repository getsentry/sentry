/*** @jsx React.DOM */

var PropTypes = require("../proptypes");

var OrganizationState = {
  contextTypes: {
    organization: PropTypes.Organization,
  },

  getOrganization() {
    return this.context.organization;
  }
};

module.exports = OrganizationState;
