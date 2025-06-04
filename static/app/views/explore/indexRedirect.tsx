import Redirect from 'sentry/components/redirect';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';

export default function ExploreIndexRedirect() {
  const organization = useOrganization();
  const defaultExploreRoute = getDefaultExploreRoute(organization);

  return (
    <Redirect
      to={normalizeUrl(
        `/organizations/${organization.slug}/explore/${defaultExploreRoute}/`
      )}
    />
  );
}
