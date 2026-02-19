import {useEffect, useRef} from 'react';
import Intercom, {shutdown, update} from '@intercom/messenger-js-sdk';

import ConfigStore from 'sentry/stores/configStore';
import useOrganization from 'sentry/utils/useOrganization';

import {useIntercomJwt} from 'getsentry/utils/useIntercomJwt';

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
  const useIntercomFeature = organization?.features.includes('intercom-support') ?? false;
  const intercomAppId = ConfigStore.get('intercomAppId');
  const hasBootedRef = useRef(false);

  const {data: jwtData} = useIntercomJwt(organization?.slug ?? '', {
    enabled: useIntercomFeature && !!organization && !!intercomAppId,
  });
  // Boot or update Intercom when JWT data is available
  useEffect(() => {
    if (!useIntercomFeature || !jwtData || !intercomAppId) {
      return;
    }

    if (hasBootedRef.current) {
      // Subsequent JWT refreshes: update with new hash without disrupting session
      update({
        user_hash: jwtData.jwt,
        email: jwtData.userData.email,
        name: jwtData.userData.name,
      });
    } else {
      // First time: initialize Intercom with full user data
      Intercom({
        app_id: intercomAppId,
        user_id: jwtData.userData.userId,
        user_hash: jwtData.jwt,
        email: jwtData.userData.email,
        name: jwtData.userData.name,
        created_at: jwtData.userData.createdAt,
        company: {
          company_id: jwtData.userData.organizationId,
          name: jwtData.userData.organizationName,
        },
      });
      hasBootedRef.current = true;
    }
  }, [useIntercomFeature, jwtData, intercomAppId]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      if (hasBootedRef.current) {
        shutdown();
        hasBootedRef.current = false;
      }
    };
  }, []);
}
