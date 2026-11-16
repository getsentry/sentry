import {useQuery} from '@tanstack/react-query';

import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {investigationCommentsQueryOptions} from 'sentry/views/investigations/api';

export function useInvestigationComments(
  investigationId: string,
  {shouldPoll = true}: {shouldPoll?: boolean} = {}
) {
  const organization = useOrganization();
  return useQuery({
    ...investigationCommentsQueryOptions({
      organizationSlug: organization.slug,
      investigationId,
    }),
    refetchInterval: shouldPoll ? 10_000 : false,
    select: selectJsonWithHeaders,
  });
}
