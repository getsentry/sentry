import {Outlet} from 'react-router-dom';

import {Redirect} from 'sentry/components/redirect';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function Projects() {
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/projects/',
    newPathPrefix: '/insights/projects/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
