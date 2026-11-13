import {useQuery} from '@tanstack/react-query';

import type {Member} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Owners and Billing members with an active account. These are the people
 * getsentry emails when someone requests a quota increase.
 */
export function useBillingMembers() {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {query: 'scope:"org:billing" isInvited:false'},
      staleTime: 0,
    })
  );
}
