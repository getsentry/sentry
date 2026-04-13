import type {UserReport} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {QueryParamValue} from 'sentry/utils/useLocation';

interface GroupUserFeedbackProps {
  groupId: string;
  query: {
    cursor?: QueryParamValue;
  };
}

export function groupUserFeedbackApiOptions(
  organization: Organization,
  {groupId, query}: GroupUserFeedbackProps
) {
  return apiOptions.as<UserReport[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/user-reports/',
    {
      path: {organizationIdOrSlug: organization.slug, issueId: groupId},
      query,
      staleTime: 0,
    }
  );
}
