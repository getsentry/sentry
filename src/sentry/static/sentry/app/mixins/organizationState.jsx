import SentryTypes from 'app/sentryTypes';

const OrganizationStateMixin = {
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
};

export default OrganizationStateMixin;
