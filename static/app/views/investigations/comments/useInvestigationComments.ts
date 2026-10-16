import {useQuery} from '@tanstack/react-query';

import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationCommentsQueryOptions} from 'sentry/views/investigations/api';

export function useInvestigationComments(
  investigationId: string,
  {archived = false}: {archived?: boolean} = {}
) {
  const organization = useOrganization();
  return useQuery({
    ...investigationCommentsQueryOptions({
      organizationSlug: organization.slug,
      investigationId,
    }),
    refetchInterval: archived ? false : 10_000,
    select: selectJsonWithHeaders,
  });
}
