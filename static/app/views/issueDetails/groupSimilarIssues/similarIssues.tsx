import {Fragment} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

function GroupSimilarIssues() {
  const params = useParams<{groupId: string}>();
  const organization = useOrganization();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});
  const project = useProjectFromSlug({
    organization,
    projectSlug: group?.project.slug,
  });

  if (isGroupPending || !project) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return (
    <Fragment>
      {/* Similarity functionality has been removed */}
      <GroupRelatedIssues group={group} />
    </Fragment>
  );
}

export default GroupSimilarIssues;
