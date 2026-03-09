import {Outlet} from 'react-router-dom';

import Redirect from 'sentry/components/redirect';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

export default function Projects() {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/insights/projects/',
    newPathPrefix: '/projects/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <Outlet />;
}
