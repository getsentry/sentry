import {Fragment, useCallback, useMemo} from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import useMutateActivity, {
  TContext,
  TData,
  TError,
  TVariables,
} from 'sentry/components/feedback/useMutateActivity';
import * as Layout from 'sentry/components/layouts/thirds';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {
  Group,
  GroupActivity as GroupActivityType,
  GroupActivityNote,
  GroupActivityReprocess,
  User,
} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {MutateOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import ActivitySection from 'sentry/views/issueDetails/activitySection';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

type Props = {
  group: Group;
} & RouteComponentProps<{}, {}>;

function GroupActivity({group}: Props) {
  const organization = useOrganization();
  const {activity: activities, count, id: groupId} = group;
  const groupCount = Number(count);
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);
  const mutators = useMutateActivity({
    organization,
    group,
  });

  const deleteOptions: MutateOptions<TData, TError, TVariables, TContext> =
    useMemo(() => {
      return {
        onError: () => {
          addErrorMessage(t('Failed to delete comment'));
        },
        onSuccess: () => {
          addSuccessMessage(t('Comment removed'));
        },
      };
    }, []);

  const createOptions: MutateOptions<TData, TError, TVariables, TContext> =
    useMemo(() => {
      return {
        onError: () => {
          addErrorMessage(t('Unable to post comment'));
        },
        onSuccess: data => {
          GroupStore.addActivity(group.id, data);
          addSuccessMessage(t('Comment posted'));
        },
      };
    }, [group.id]);

  const updateOptions: MutateOptions<TData, TError, TVariables, TContext> =
    useMemo(() => {
      return {
        onError: () => {
          addErrorMessage(t('Unable to update comment'));
        },
        onSuccess: data => {
          const d = data as GroupActivityNote;
          GroupStore.updateActivity(group.id, data.id, {text: d.data.text});
          addSuccessMessage(t('Comment updated'));
        },
      };
    }, [group.id]);

  const handleDelete = useCallback(
    (item: GroupActivityType) => {
      const restore = group.activity.find(activity => activity.id === item.id);
      const index = GroupStore.removeActivity(group.id, item.id);

      if (index === -1 || restore === undefined) {
        addErrorMessage(t('Failed to delete comment'));
        return;
      }
      mutators.handleDelete(
        item.id,
        group.activity.filter(a => a.id !== item.id),
        deleteOptions
      );
    },
    [deleteOptions, group.activity, mutators, group.id]
  );

  const handleCreate = useCallback(
    (n: NoteType, _me: User) => {
      mutators.handleCreate(n, group.activity, createOptions);
    },
    [createOptions, group.activity, mutators]
  );

  const handleUpdate = useCallback(
    (item: GroupActivityType, n: NoteType) => {
      mutators.handleUpdate(n, item.id, group.activity, updateOptions);
    },
    [updateOptions, group.activity, mutators]
  );

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
            group={group}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            placeholderText={t(
              'Add details or updates to this event. \nTag users with @, or teams with #'
            )}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default GroupActivity;
