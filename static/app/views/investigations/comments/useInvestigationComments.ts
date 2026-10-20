import {useQuery} from '@tanstack/react-query';

import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationCommentsQueryOptions} from 'sentry/views/investigations/api';

export function useInvestigationComments(investigationId: string) {
  const organization = useOrganization();
  return useQuery({
    ...investigationCommentsQueryOptions({
      organizationSlug: organization.slug,
      investigationId,
    }),
    refetchInterval: 10_000,
    select: selectJsonWithHeaders,
  });
}
