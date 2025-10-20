import {Outlet} from 'react-router-dom';

import Redirect from 'sentry/components/redirect';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

export default function ReleasesContainer() {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/releases/',
    newPathPrefix: '/explore/releases/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
