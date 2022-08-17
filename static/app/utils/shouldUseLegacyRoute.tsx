import {OrganizationSummary} from 'sentry/types';

function shouldUseLegacyRoute(organization: OrganizationSummary) {
  const {links} = organization;
  const {organizationUrl} = links;
  return !organizationUrl || !organization.features.includes('customer-domains');
}

export default shouldUseLegacyRoute;
