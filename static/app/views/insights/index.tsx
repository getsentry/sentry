import {Redirect} from 'sentry/components/redirect';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getLastUsedDomainView} from './common/utils/domainRedirect';
import {DOMAIN_VIEW_BASE_URL} from './pages/settings';

/**
 * Redirect to the last used domain view
 * domain view usage is tracked in localStorage via useRegisterDomainViewUsage
 */
export default function InsightsIndex() {
  const lastUsedDomainView = getLastUsedDomainView();
  const organization = useOrganization();
  return (
    <Redirect
      to={normalizeUrl(
        `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${lastUsedDomainView}/`
      )}
    />
  );
}
