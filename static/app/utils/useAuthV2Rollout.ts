import {useEffect} from 'react';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  AuthV2CookieState,
  getAuthV2CookieState,
  useEnableAuthV2,
} from 'sentry/utils/useEnableAuthV2';

export function useAuthV2Rollout() {
  const {loading, organization} = useLegacyStore(OrganizationStore);
  const {authV2RolloutOrganization, setAuthV2CookieState} = useEnableAuthV2();

  useEffect(() => {
    if (loading || !organization) {
      return;
    }

    const authV2CookieState = getAuthV2CookieState();
    if (!organization.features.includes('authv2-rollout')) {
      if (
        authV2CookieState === AuthV2CookieState.ENABLED &&
        authV2RolloutOrganization === organization.slug
      ) {
        setAuthV2CookieState(AuthV2CookieState.UNSET);
        trackAnalytics('auth_v2.rollout.changed', {
          organization,
          source: 'feature_flag',
          state: 'unset',
        });
      }
      return;
    }

    if (authV2CookieState === AuthV2CookieState.UNSET) {
      setAuthV2CookieState(AuthV2CookieState.ENABLED, organization.slug);
      trackAnalytics('auth_v2.rollout.changed', {
        organization,
        source: 'feature_flag',
        state: 'enabled',
      });
    }
  }, [authV2RolloutOrganization, loading, organization, setAuthV2CookieState]);
}
