import {Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {ActivityFeed} from 'sentry/views/issueDetails/activitySection/activityFeed';
import {
  ActivityFeedItem,
  getActivityFeedItemKey,
} from 'sentry/views/issueDetails/activitySection/activityFeedItem';
import {buildActivityFeedItems} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {useActivityComments} from 'sentry/views/issueDetails/activitySection/useActivityComments';

interface IssuePreviewTimelineProps {
  group: Group;
}

export function IssuePreviewTimeline({group}: IssuePreviewTimelineProps) {
  const {onCreate, onDelete, onUpdate} = useActivityComments({group});
  const items = buildActivityFeedItems({activities: group.activity});

  return (
    <Grid gap="xl">
      <ActivityNoteInput
        storageKey="groupinput:latest"
        itemKey={group.id}
        minHeight={40}
        onSubmit={onCreate}
        placeholder={t('Add a comment. Tag users with @, or teams with #')}
        variant="full"
      />
      <ActivityFeed>
        {items.map(item => (
          <ActivityFeedItem
            key={getActivityFeedItemKey(item)}
            group={group}
            item={item}
            inputVariant="full"
            onCommentDelete={onDelete}
            onCommentUpdate={onUpdate}
          />
        ))}
      </ActivityFeed>
    </Grid>
  );
}
