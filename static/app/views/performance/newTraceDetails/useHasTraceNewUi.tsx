import {useMemo} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

export function useHasTraceNewUi(): boolean {
  const organization = useOrganization();

  return useMemo(() => {
    return true; //organization.features.includes('trace-view-new-ui');
  }, [organization.features]);
}
