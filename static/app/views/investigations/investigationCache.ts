import type {QueryClient} from '@tanstack/react-query';

import {getInvestigationDetailQueryOptions} from './api';
import type {InvestigationDetail} from './types';

export function updateInvestigationCache(
  queryClient: QueryClient,
  organizationSlug: string,
  investigationId: string,
  update: (current: InvestigationDetail) => InvestigationDetail
) {
  const options = getInvestigationDetailQueryOptions(organizationSlug, investigationId);

  queryClient.setQueryData(options.queryKey, previous =>
    previous
      ? {
          ...previous,
          json: update(previous.json),
        }
      : previous
  );
}
