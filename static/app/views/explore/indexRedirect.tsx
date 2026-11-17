import {Redirect} from 'sentry/components/redirect';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function ExploreIndexRedirect() {
  const organization = useOrganization();
  return (
    <Redirect to={normalizeUrl(`/organizations/${organization.slug}/explore/traces/`)} />
  );
}
