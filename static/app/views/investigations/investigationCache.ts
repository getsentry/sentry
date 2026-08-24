import type {QueryClient} from '@tanstack/react-query';

import {investigationDetailQueryOptions} from 'sentry/views/investigations/api';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

export function updateInvestigationCache(
  queryClient: QueryClient,
  organizationSlug: string,
  investigationId: string,
  update: (current: InvestigationDetail) => InvestigationDetail
) {
  const options = investigationDetailQueryOptions(organizationSlug, investigationId);

  queryClient.setQueryData(options.queryKey, previous =>
    previous
      ? {
          ...previous,
          json: update(previous.json),
        }
      : previous
  );
}
