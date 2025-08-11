import {useMemo} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Scope} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';

const TEMPEST_WRITE_ACCESS: Scope[] = ['org:admin', 'project:admin', 'project:write'];

export function useHasTempestWriteAccess() {
  const organization = useOrganization();

  return useMemo(
    () => hasEveryAccess(TEMPEST_WRITE_ACCESS, {organization}),
    [organization]
  );
}
