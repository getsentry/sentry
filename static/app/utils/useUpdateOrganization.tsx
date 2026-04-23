import {useMutation} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';

import {useOrganizationMutationOptions} from './organization/useOrganizationMutationOptions';

export function useUpdateOrganization(organization: Organization) {
  return useMutation(useOrganizationMutationOptions(organization));
}
