import {useEffect} from 'react';
import {useStore} from 'zustand';

import {DEFAULT_APP_ROUTE} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {getOrganizationHomePath} from 'sentry/utils/organizationHomePath';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * This view is used when a user lands on the route `/` which historically
 * is a server-rendered route which redirects the user to their last selected organization
 *
 * However, this does not work when in the experimental SPA mode (e.g. developing against a remote API,
 * or a deploy preview), so we must replicate the functionality and redirect
 * the user to the proper organization.
 *
 * The home page depends on the organization's features, so this waits for the
 * organization to load before redirecting.
 */
function AppRoot() {
  const lastOrganization = useStore(ConfigStore, state => state.lastOrganization);
  const organization = useStore(OrganizationStore, state => state.organization);
  const error = useStore(OrganizationStore, state => state.error);
  const navigate = useNavigate();

  useEffect(() => {
    if (organization) {
      navigate(normalizeUrl(getOrganizationHomePath(organization)), {replace: true});
      return;
    }

    // Without organization details, fall back to the issue list so the error
    // surfaces there instead of on a blank page.
    if (error && lastOrganization) {
      const url = replaceRouterParams(DEFAULT_APP_ROUTE, {orgSlug: lastOrganization});
      navigate(url, {replace: true});
    }
  }, [organization, error, lastOrganization, navigate]);

  return null;
}

export default AppRoot;
