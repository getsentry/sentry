import {Navigate} from 'react-router';
import {useStore} from 'zustand';

import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {getOrganizationHomePath} from 'sentry/utils/organizationHomePath';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useParams} from 'sentry/utils/useParams';

/**
 * Sends `/organizations/:orgId/` to the organization's home page. The home
 * page depends on the organization's features, so this waits for the
 * organization to load.
 */
export function OrganizationHomeRedirect() {
  const {orgId} = useParams<{orgId: string}>();
  const organization = useStore(OrganizationStore, state => state.organization);
  const error = useStore(OrganizationStore, state => state.error);

  if (error) {
    return <Navigate to={normalizeUrl(`/organizations/${orgId}/issues/`)} replace />;
  }

  // Deploy previews always load the last organization, whatever the URL says.
  // Elsewhere, wait until the store holds the organization from the URL.
  if (!organization || (!DEPLOY_PREVIEW_CONFIG && organization.slug !== orgId)) {
    return null;
  }

  return <Navigate to={normalizeUrl(getOrganizationHomePath(organization))} replace />;
}
