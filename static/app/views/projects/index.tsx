import {Outlet} from 'react-router-dom';

import {Redirect} from 'sentry/components/redirect';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function Projects() {
  const organization = useOrganization();
  // Both hooks are called unconditionally (React rules of hooks), but only one
  // can match at a time since the current URL can't start with both prefixes.
  // We select which result to act on based on the feature flag.
  const forwardRedirect = useRedirectNavigationV2Routes({
    oldPathPrefix: '/projects/',
    newPathPrefix: '/insights/projects/',
  });
  const reverseRedirect = useRedirectNavigationV2Routes({
    oldPathPrefix: '/insights/projects/',
    newPathPrefix: '/projects/',
  });

  const redirectPath = organization.features.includes('workflow-engine-ui')
    ? reverseRedirect
    : forwardRedirect;

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
