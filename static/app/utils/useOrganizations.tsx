import {useStore} from 'zustand';

import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import type {OrganizationSummary} from 'sentry/types/organization';

/**
 * Every organization the current user belongs to, loaded once at startup. For
 * the organization currently being viewed, use `useOrganization` instead.
 */
export function useOrganizations(): readonly OrganizationSummary[] {
  return useStore(OrganizationsStore, state => state.organizations);
}
