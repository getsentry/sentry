import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import * as Layout from 'sentry/components/layouts/thirds';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {t} from 'sentry/locale';
import {Group, GroupActivityReprocess, Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import ActivitySection from 'sentry/views/issueDetails/activitySection';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

function GroupActivity(props: Props) {
  const organization = useOrganization();
  const {group} = props;
  const {activity: activities, count, id: groupId} = group;
  const groupCount = Number(count);
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);
  const mutators = useMutateActivity({
    organization,
    group,
  });

  const deleteMutationOptions = {
    onError: () => {
      addErrorMessage(t('Failed to delete comment'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment removed'));
    },
  };

  const addMutationOptions = {
    onError: () => {
      addErrorMessage(t('Unable to post comment'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment posted'));
    },
  };

  const updateMutationOptions = {
    onError: () => {
      addErrorMessage(t('Unable to update comment'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment updated'));
    },
  };

  return (
    <Fragment>
      {(reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT ||
        reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HAS_EVENT) && (
        <ReprocessedBox
          reprocessActivity={mostRecentActivity as GroupActivityReprocess}
          groupCount={groupCount}
          orgSlug={organization.slug}
          groupId={groupId}
        />
      )}

      <Layout.Body>
        <Layout.Main>
          <ActivitySection
            issueActivity
            group={group}
            mutators={mutators}
            placeholderText={t(
              'Add details or updates to this event. \nTag users with @, or teams with #'
            )}
            updateMutationOptions={updateMutationOptions}
            addMutationOptions={addMutationOptions}
            deleteMutationOptions={deleteMutationOptions}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export {GroupActivity};
export default withApi(withOrganization(GroupActivity));
