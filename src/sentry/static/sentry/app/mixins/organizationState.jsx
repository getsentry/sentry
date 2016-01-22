import PropTypes from '../proptypes';

let OrganizationState = {
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
  },

  getOnboardingTasks() {
    return new Set(this.context.organization.onboardingTasks);
  },
};

export default OrganizationState;

