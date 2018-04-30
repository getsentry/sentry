import SentryTypes from 'app/proptypes';

let OrganizationStateMixin = {
  contextTypes: {
    organization: SentryTypes.Organization,
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

export default OrganizationStateMixin;

// Non-mixin version for use with es6 components
export const getOrganizationState = function(org) {
  return {
    getOrganization: () => {
      return org;
    },
    getAccess: () => {
      return new Set(org.access);
    },
    getFeatures: () => {
      return new Set(org.features);
    },
    getOnboardingTasks: () => {
      return new Set(org.onboardingTasks);
    },
  };
};
