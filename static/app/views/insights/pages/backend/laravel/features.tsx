import type {Organization} from 'sentry/types/organization';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useUser} from 'sentry/utils/useUser';

export function hasLaravelInsightsFeature(organization: Organization) {
  return organization.features.includes('laravel-insights');
}

export function useIsLaravelInsightsEnabled() {
  const user = useUser();
  return useLocalStorageState(`laravel-insights-enabled-${user.id}`, true);
}
