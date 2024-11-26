import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

import SimilarStackTrace from './similarStackTrace';

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
      <Feature features="similarity-view" project={project}>
        <SimilarStackTrace project={project} />
      </Feature>
      <Feature features="related-issues">
        <GroupRelatedIssues />
      </Feature>
    </Fragment>
  );
}

export default GroupSimilarIssues;
