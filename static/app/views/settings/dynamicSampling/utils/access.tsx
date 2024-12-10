import {useMemo} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Scope} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';

const DYNAMIC_SAMPLING_WRITE_ACCESS: Scope[] = ['org:write'];

export function useHasDynamicSamplingWriteAccess() {
  const organization = useOrganization();

  return useMemo(
    () => hasEveryAccess(DYNAMIC_SAMPLING_WRITE_ACCESS, {organization}),
    [organization]
  );
}
