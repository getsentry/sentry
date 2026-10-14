import type {TimeSince} from 'sentry/components/timeSince';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivityNote} from 'sentry/types/group';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import type {DisplayedActivityFeedItem} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {CollapsedStatusActivityRow} from 'sentry/views/issueDetails/activitySection/activityLineItem/collapsedStatusActivityRow';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';

interface ActivityFeedItemProps {
  group: Group;
  inputVariant: 'compact' | 'full';
  item: DisplayedActivityFeedItem;
  onCommentDelete: (item: GroupActivityNote) => Promise<void>;
  onCommentUpdate: (item: GroupActivityNote, data: NoteType) => Promise<void>;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function getActivityFeedItemKey({activity}: DisplayedActivityFeedItem): string {
  return isActivityNote(activity)
    ? `comment:${activity.commentId}`
    : `activity:${activity.id}`;
}

export function ActivityFeedItem({
  item,
  group,
  inputVariant,
  onCommentDelete,
  onCommentUpdate,
  timestampUnitStyle,
}: ActivityFeedItemProps) {
  if (item.type === 'collapsed_status_activities') {
    return (
      <CollapsedStatusActivityRow eventCount={item.activities.length}>
        {item.activities.map(activity => (
          <ActivityFeedItem
            key={getActivityFeedItemKey(activity)}
            item={activity}
            group={group}
            inputVariant={inputVariant}
            onCommentDelete={onCommentDelete}
            onCommentUpdate={onCommentUpdate}
            timestampUnitStyle={timestampUnitStyle}
          />
        ))}
      </CollapsedStatusActivityRow>
    );
  }

  const {activity} = item;
  if (isActivityNote(activity)) {
    return (
      <ActivityLineNote
        activity={activity}
        inputVariant={inputVariant}
        onDelete={() => onCommentDelete(activity)}
        onUpdate={data => onCommentUpdate(activity, data)}
        timestampUnitStyle={timestampUnitStyle}
      />
    );
  }

  return (
    <ActivityLine item={item} group={group} timestampUnitStyle={timestampUnitStyle} />
  );
}
