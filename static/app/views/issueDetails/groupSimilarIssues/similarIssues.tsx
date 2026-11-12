import {Fragment} from 'react';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';
import {useGroupId} from 'sentry/views/issueDetails/groupIdContext';
import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import {SimilarStackTrace} from './similarStackTrace';

export function GroupSimilarIssues() {
  const groupId = useGroupId();
  const organization = useOrganization();
  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId});
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
      {project.features.includes('similarity-view') && (
        <SimilarStackTrace project={project} />
      )}
      <GroupRelatedIssues group={group} />
    </Fragment>
  );
}
