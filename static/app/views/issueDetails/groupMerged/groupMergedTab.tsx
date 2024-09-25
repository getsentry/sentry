import * as Layout from 'sentry/components/layouts/thirds';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';

interface GroupMergedTabProps {
  project: Project;
}

function GroupMergedTab({project}: GroupMergedTabProps) {
  const {groupId} = useParams<{groupId: Group['id']}>();
  const location = useLocation();

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <GroupMergedView project={project} params={{groupId}} location={location} />
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupMergedTab;
