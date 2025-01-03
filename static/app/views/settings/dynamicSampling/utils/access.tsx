import {useMemo} from 'react';

import type {Scope} from 'sentry/types/core';

import {hasEveryAccess} from 'sentry/components/acl/access';
import useOrganization from 'sentry/utils/useOrganization';

const DYNAMIC_SAMPLING_WRITE_ACCESS: Scope[] = ['org:write'];

export function useHasDynamicSamplingWriteAccess() {
  const organization = useOrganization();

  return useMemo(
    () => hasEveryAccess(DYNAMIC_SAMPLING_WRITE_ACCESS, {organization}),
    [organization]
  );
}
