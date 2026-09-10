import {useEffect, useRef} from 'react';
import {Outlet, useLocation} from 'react-router-dom';

import {openOrganizationSsoModal} from 'sentry/actionCreators/organizationSsoModal';
import {initApiClientErrorHandling} from 'sentry/api';
import {AuthV2CookieState, getAuthV2CookieState} from 'sentry/utils/useEnableAuthV2';

export function AuthenticatedApiErrorHandler() {
  const promptedSso = useRef<{
    organizationSlug: string;
    pathname: string;
  } | null>(null);
  const {pathname} = useLocation();

  useEffect(
    () =>
      initApiClientErrorHandling({
        onSsoRequired: ssoRequired => {
          if (getAuthV2CookieState() !== AuthV2CookieState.ENABLED) {
            return false;
          }

          if (
            promptedSso.current?.organizationSlug === ssoRequired.organizationSlug &&
            promptedSso.current.pathname === pathname
          ) {
            return true;
          }

          promptedSso.current = {
            organizationSlug: ssoRequired.organizationSlug,
            pathname,
          };

          openOrganizationSsoModal(ssoRequired);
          return true;
        },
      }),
    [pathname]
  );

  return <Outlet />;
}
