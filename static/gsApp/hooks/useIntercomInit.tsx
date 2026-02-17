import {useEffect, useRef} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {
  bootIntercom,
  hasIntercom,
  shutdownIntercom,
  updateIntercom,
} from 'sentry/utils/intercom';
import useOrganization from 'sentry/utils/useOrganization';

import {useIntercomJwt} from 'getsentry/hooks/useIntercomJwt';

/**
 * Hook to initialize Intercom with identity verification.
 *
 * This hook:
 * 1. Checks if the organization has the intercom-support feature enabled
 * 2. Fetches a JWT for identity verification
 * 3. Boots Intercom with the JWT and user data
 * 4. Shuts down Intercom when the component unmounts
 *
 * Use this hook at the app level to initialize Intercom for authenticated sessions.
 */
export function useIntercomInit(): void {
  const organization = useOrganization({allowNull: true});
  const useIntercom = organization?.features.includes('intercom-support') ?? false;
  const intercomAppId = ConfigStore.get('intercomAppId');
  const hasBootedRef = useRef(false);

  const {data: jwtData} = useIntercomJwt(organization?.slug ?? '', {
    enabled: useIntercom && !!organization && !!intercomAppId,
  });

  // Boot or update Intercom when JWT data is available
  useEffect(() => {
    if (!useIntercom || !jwtData || !hasIntercom() || !intercomAppId) {
      return;
    }

    if (hasBootedRef.current) {
      // Subsequent JWT refreshes: update with new hash without disrupting session
      updateIntercom(jwtData.userData, jwtData.jwt);
    } else {
      // First time: boot Intercom with full user data
      bootIntercom(intercomAppId, jwtData.jwt, jwtData.userData);
      hasBootedRef.current = true;
    }
  }, [useIntercom, jwtData, intercomAppId]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      if (hasBootedRef.current && hasIntercom()) {
        shutdownIntercom();
        hasBootedRef.current = false;
      }
    };
  }, []);
}
