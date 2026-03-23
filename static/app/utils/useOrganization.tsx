import {useContext} from 'react';

import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Options<AllowNull extends boolean = boolean> {
  /**
   * Allows null to be returned when there is no organization in context. This
   * can happen when the user is not part of an organization
   *
   * @default false
   */
  allowNull?: AllowNull;
}

// The additional signatures provide proper type hints for when we set
// `allowNull` to true.

export function useOrganization(opts?: Options<false>): Organization;
export function useOrganization(opts: Options<true>): Organization | null;

export function useOrganization({allowNull = false}: Options = {}) {
  const organization = useContext(OrganizationContext);

  // if (organization && !organization.features?.includes('page-frame')) {
  //   organization.features = [...(organization?.features ?? []), 'page-frame'];
  // }

  if (allowNull) {
    return organization;
  }

  if (!organization) {
    throw new Error('useOrganization called but organization is not set.');
  }

  return organization;
}
