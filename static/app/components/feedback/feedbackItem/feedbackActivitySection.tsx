import {useCallback, useMemo} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import {t} from 'sentry/locale';
import {
  Group,
  GroupActivity,
  GroupActivityNote,
  GroupActivityType,
  User,
} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {FeedbackIssue} from 'sentry/utils/feedback/types';
import {uniqueId} from 'sentry/utils/guid';
import useOrganization from 'sentry/utils/useOrganization';
import ActivitySection from 'sentry/views/issueDetails/activitySection';

type Props = {
  feedbackItem: FeedbackIssue;
};

function FeedbackActivitySection(props: Props) {
  const {feedbackItem} = props;
  const organization = useOrganization();

  const {updateCached, invalidateCached} = useFeedbackCache();

  const mutators = useMutateActivity({
    onMutate: ([{activity}, _method]) => {
      updateCached([feedbackItem.id], {activity});
    },
    onSettled: (_resp, _error, _var, _context) => {
      invalidateCached([feedbackItem.id]);
    },
    organization,
    group: feedbackItem as unknown as Group,
  });

  const deleteOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('An error occurred while removing the comment.'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Comment removed'));
      },
    };
  }, []);

  const createOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('An error occurred while posting the comment.'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Comment posted'));
      },
    };
  }, []);

  const updateOptions = useMemo(() => {
    return {
      onError: () => {
        addErrorMessage(t('An error occurred while updating the comment.'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Comment updated'));
      },
    };
  }, []);

  const handleDelete = useCallback(
    (item: GroupActivity) => {
      mutators.handleDelete(
        item.id,
        feedbackItem.activity.filter(a => a.id !== item.id),
        deleteOptions
      );
    },
    [deleteOptions, feedbackItem.activity, mutators]
  );

  const handleCreate = useCallback(
    (n: NoteType, me: User) => {
      const newActivity: GroupActivityNote = {
        id: uniqueId(), // temporary unique id, for cache use only
        data: n,
        type: GroupActivityType.NOTE,
        dateCreated: new Date().toISOString(),
        project: feedbackItem.project,
        user: me,
      };
      mutators.handleCreate(n, [newActivity, ...feedbackItem.activity], createOptions);
    },
    [createOptions, feedbackItem.activity, mutators, feedbackItem.project]
  );

  const handleUpdate = useCallback(
    (item: GroupActivity, n: NoteType) => {
      mutators.handleUpdate(n, item.id, feedbackItem.activity, updateOptions);
    },
    [updateOptions, feedbackItem.activity, mutators]
  );

  return (
    <ActivitySection
      group={feedbackItem as unknown as Group}
      onDelete={handleDelete}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      placeholderText={t(
        'Add details or updates to this feedback. \nTag users with @, or teams with #'
      )}
    />
  );
}

export default FeedbackActivitySection;
