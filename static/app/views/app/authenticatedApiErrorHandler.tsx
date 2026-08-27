import {useEffect} from 'react';
import {Outlet} from 'react-router-dom';

import {initApiClientErrorHandling} from 'sentry/api';

export function AuthenticatedApiErrorHandler() {
  useEffect(() => initApiClientErrorHandling(), []);

  return <Outlet />;
}
