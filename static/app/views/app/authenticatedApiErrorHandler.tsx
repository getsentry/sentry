import {useEffect} from 'react';

import {initApiClientErrorHandling} from 'sentry/api';
import {Outlet} from 'sentry/router/reactRouter';

export function AuthenticatedApiErrorHandler() {
  useEffect(() => initApiClientErrorHandling(), []);

  return <Outlet />;
}
