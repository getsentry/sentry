import {Fragment, useCallback, useEffect, useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {
  TContext,
  TData,
  TError,
  TVariables,
} from 'sentry/components/feedback/useMutateActivity';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import type {NoteType} from 'sentry/types/alerts';
import type {
  Group,
  GroupActivity as GroupActivityType,
  GroupActivityNote,
  GroupActivityReprocess,
} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import type {MutateOptions} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ActivitySection from 'sentry/views/issueDetails/activitySection';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
  useHasStreamlinedUI,
} from 'sentry/views/issueDetails/utils';

export type MutateActivityOptions = MutateOptions<TData, TError, TVariables, TContext>;

interface GroupActivityProps {
  group: Group;
}

function GroupActivity({group}: GroupActivityProps) {
  const organization = useOrganization();
  const {activity: activities, count, id: groupId} = group;
  const groupCount = Number(count);
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);
  const mutators = useMutateActivity({
    organization,
    group,
  });

  const deleteOptions: MutateActivityOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('Failed to delete comment'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Comment removed'));
      },
    };
  }, []);

  const createOptions: MutateActivityOptions = useMemo(() => {
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

  const updateOptions: MutateActivityOptions = useMemo(() => {
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

function GroupActivityRoute() {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const navigate = useNavigate();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  const params = useParams<{groupId: string}>();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  // TODO(streamlined-ui): Activity will become a router redirect to the event details page
  useEffect(() => {
    if (hasStreamlinedUI) {
      navigate({
        ...location,
        pathname: baseUrl,
      });
    }
  }, [hasStreamlinedUI, navigate, baseUrl, location]);

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return <GroupActivity group={group} />;
}

export default GroupActivityRoute;
