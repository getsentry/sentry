import {useEffect, useRef} from 'react';
import {Outlet} from 'react-router-dom';

import {openOrganizationSsoModal} from 'sentry/actionCreators/organizationSsoModal';
import {initApiClientErrorHandling} from 'sentry/api';
import {AuthV2CookieState, getAuthV2CookieState} from 'sentry/utils/useEnableAuthV2';

export function AuthenticatedApiErrorHandler() {
  const activeSsoOrganizationSlug = useRef<string | null>(null);

  useEffect(
    () =>
      initApiClientErrorHandling({
        onSsoRequired: ssoRequired => {
          if (getAuthV2CookieState() !== AuthV2CookieState.ENABLED) {
            return false;
          }

          if (activeSsoOrganizationSlug.current === ssoRequired.organizationSlug) {
            return true;
          }

          activeSsoOrganizationSlug.current = ssoRequired.organizationSlug;

          openOrganizationSsoModal({
            ...ssoRequired,
            onClose: () => {
              if (activeSsoOrganizationSlug.current === ssoRequired.organizationSlug) {
                activeSsoOrganizationSlug.current = null;
              }
            },
          });
          return true;
        },
      }),
    []
  );

  return <Outlet />;
}
