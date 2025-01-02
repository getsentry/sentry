import {useEffect} from 'react';

import {DEFAULT_APP_ROUTE} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * This view is used when a user lands on the route `/` which historically
 * is a server-rendered route which redirects the user to their last selected organization
 *
 * However, this does not work when in the experimental SPA mode (e.g. developing against a remote API,
 * or a deploy preview), so we must replicate the functionality and redirect
 * the user to the proper organization.
 *
 * TODO: There might be an edge case where user does not have `lastOrganization` set,
 * in which case we should load their list of organizations and make a decision
 */
function AppRoot() {
  const {lastOrganization} = useLegacyStore(ConfigStore);
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastOrganization) {
      return;
    }

    const orgSlug = lastOrganization;
    const url = replaceRouterParams(DEFAULT_APP_ROUTE, {orgSlug});

    navigate(url, {replace: true});
  }, [lastOrganization, navigate]);

  return null;
}

export default AppRoot;
