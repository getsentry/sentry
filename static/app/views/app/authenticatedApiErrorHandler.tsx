import {useEffect, useRef} from 'react';
import {Outlet, useLocation} from 'react-router-dom';

import {openOrganizationSsoModal} from 'sentry/actionCreators/organizationSsoModal';
import {initApiClientErrorHandling} from 'sentry/api';
import {AuthV2CookieState, getAuthV2CookieState} from 'sentry/utils/useEnableAuthV2';

export function AuthenticatedApiErrorHandler() {
  const promptedSsoOrganizationSlug = useRef<string | null>(null);
  const {pathname} = useLocation();

  useEffect(() => {
    promptedSsoOrganizationSlug.current = null;
  }, [pathname]);

  useEffect(
    () =>
      initApiClientErrorHandling({
        onSsoRequired: ssoRequired => {
          if (getAuthV2CookieState() !== AuthV2CookieState.ENABLED) {
            return false;
          }

          if (promptedSsoOrganizationSlug.current === ssoRequired.organizationSlug) {
            return true;
          }

          promptedSsoOrganizationSlug.current = ssoRequired.organizationSlug;

          openOrganizationSsoModal(ssoRequired);
          return true;
        },
      }),
    []
  );

  return <Outlet />;
}
