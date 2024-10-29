import {useMemo} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

export function useHasTraceNewUi(): boolean {
  const organization = useOrganization();

  return useMemo(() => {
    return organization.features.includes('trace-view-new-ui');
  }, [organization.features]);
}
