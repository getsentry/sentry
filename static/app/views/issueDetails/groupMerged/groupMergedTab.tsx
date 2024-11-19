import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

function GroupMergedTab() {
  const params = useParams<{groupId: Group['id']}>();
  const location = useLocation();
  const hasStreamlinedUI = useHasStreamlinedUI();
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

  // TODO(streamline-ui): Point router to event details page since merged issues opens in a drawer.
  if (hasStreamlinedUI) {
    return <GroupEventDetails />;
  }

  if (isGroupPending || !project) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <GroupMergedView project={project} groupId={params.groupId} location={location} />
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupMergedTab;
