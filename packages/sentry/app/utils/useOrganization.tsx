import {useContext} from 'react';

import {OrganizationContext} from 'sentry/views/organizationContext';

function useOrganization() {
  const organization = useContext(OrganizationContext);
  if (!organization) {
    throw new Error('useOrganization called but organization is not set.');
  }
  return organization;
}

export default useOrganization;
