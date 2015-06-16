var PropTypes = require("../proptypes");

var OrganizationState = {
  contextTypes: {
    organization: PropTypes.Organization,
  },

  getOrganization() {
    return this.context.organization;
  },

  getAccess() {
    return new Set(this.context.organization.access);
  },

  getFeatures() {
    return new Set(this.context.organization.features);
  }
};

module.exports = OrganizationState;
