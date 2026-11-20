import {useStore} from 'zustand';

import {ConfigStore} from 'sentry/stores/configStore';

/**
 * Whether the current user can create a new organization. This is a system
 * feature checked against the user, so it is not on `organization.features`.
 */
export function useCanCreateOrganization(): boolean {
  return useStore(ConfigStore, state => state.features.has('organizations:create'));
}
