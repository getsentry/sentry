import {OrganizationSummary} from 'sentry/types';

// TODO rename to shouldUseSlugPathRoute ?
function shouldUseLegacyRoute(organization: OrganizationSummary) {
  const {organizationUrl} = organization.links;
  return !organizationUrl || !organization.features.includes('customer-domains');
}

export default shouldUseLegacyRoute;
