import {useContext} from 'react';

import {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/views/organizationContext';

function useOrganization(): Organization {
  const organization = useContext(OrganizationContext);
  if (!organization) {
    throw new Error('useOrganization called but organization is not set.');
  }
  return organization;
}

export default useOrganization;
