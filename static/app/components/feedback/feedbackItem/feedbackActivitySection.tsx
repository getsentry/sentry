import {useCallback} from 'react';

import {useFeedbackCache} from 'sentry/components/feedback/useFeedbackCache';
import {t} from 'sentry/locale';
import {GroupActivityType, type Group, type GroupActivity} from 'sentry/types/group';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';

type Props = {
  feedbackItem: Group;
};

export function FeedbackActivitySection(props: Props) {
  const {feedbackItem} = props;

  const {updateCached, invalidateCached} = useFeedbackCache();

  const handleCommentChange = useCallback(
    (activity: GroupActivity[]) => {
      updateCached([feedbackItem.id], {activity});
      invalidateCached([feedbackItem.id]);
    },
    [updateCached, invalidateCached, feedbackItem.id]
  );

  const filteredActivity = feedbackItem.activity.filter(
    a => a.type !== GroupActivityType.FIRST_SEEN
  );

  return (
    <ActivitySection
      group={{...feedbackItem, activity: filteredActivity} as unknown as Group}
      onCommentCreated={handleCommentChange}
      onCommentDeleted={handleCommentChange}
      onCommentEdited={handleCommentChange}
      variant="standalone"
      placeholder={t(
        'Add details or updates to this feedback, visible only to your organization. \nTag users with @, or teams with #'
      )}
    />
  );
}
