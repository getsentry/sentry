import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t, tct} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivity, GroupActivityNote} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {isActivityNote} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';

interface UseActivityCommentsOptions {
  group: Group;
  activities?: GroupActivity[];
  onActivityChange?: (activity: GroupActivity[]) => void;
}

export function useActivityComments({
  group,
  activities = group.activity,
  onActivityChange,
}: UseActivityCommentsOptions) {
  const organization = useOrganization();
  const {createComment, deleteComment, updateComment} = useMutateActivity({
    organization,
    group,
  });

  async function onCreate(data: NoteType) {
    try {
      const result = await createComment(data);
      trackAnalytics('issue_details.comment_created', {organization});
      addSuccessMessage(t('Comment posted'));
      onActivityChange?.([result, ...activities]);
    } catch (error) {
      const detail =
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : null;
      addErrorMessage(
        detail ? tct('Error: [msg]', {msg: detail}) : t('Unable to post comment')
      );
      throw error;
    }
  }

  async function onDelete(item: GroupActivityNote) {
    const commentId = item.commentId;
    await deleteComment(commentId);
    trackAnalytics('issue_details.comment_deleted', {organization});
    addSuccessMessage(t('Comment removed'));
    onActivityChange?.(
      activities.filter(
        activity => !isActivityNote(activity) || activity.commentId !== commentId
      )
    );
  }

  async function onUpdate(item: GroupActivityNote, data: NoteType) {
    try {
      const commentId = item.commentId;
      const result = await updateComment(commentId, data);
      trackAnalytics('issue_details.comment_updated', {organization});
      addSuccessMessage(t('Comment updated'));
      onActivityChange?.(
        activities.map(activity =>
          isActivityNote(activity) && activity.commentId === commentId
            ? {...activity, data: {...activity.data, ...result.data}}
            : activity
        )
      );
    } catch (error) {
      addErrorMessage(t('Unable to update comment'));
      throw error;
    }
  }

  return {onCreate, onDelete, onUpdate};
}
