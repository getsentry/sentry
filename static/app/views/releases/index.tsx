import {Outlet} from 'react-router-dom';

import Redirect from 'sentry/components/redirect';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function ReleasesContainer() {
  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/releases/',
    newPathPrefix: '/explore/releases/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
