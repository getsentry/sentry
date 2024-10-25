import * as Layout from 'sentry/components/layouts/thirds';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import GroupEventDetails, {
  type GroupEventDetailsProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

function GroupMergedTab(props: GroupEventDetailsProps) {
  const {groupId} = useParams<{groupId: Group['id']}>();
  const location = useLocation();
  const hasStreamlinedUI = useHasStreamlinedUI();

  // TODO(streamline-ui): Point router to event details page since merged issues opens in a drawer.
  if (hasStreamlinedUI) {
    return <GroupEventDetails {...props} />;
  }

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <GroupMergedView project={props.project} params={{groupId}} location={location} />
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupMergedTab;
