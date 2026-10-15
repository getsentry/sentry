import type {TimeSince} from 'sentry/components/timeSince';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivityNote} from 'sentry/types/group';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import type {DisplayedActivityFeedItem} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {CollapsedStatusActivityRow} from 'sentry/views/issueDetails/activitySection/activityLineItem/collapsedStatusActivityRow';
import {ActivityLineList} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';

interface ActivityFeedProps {
  group: Group;
  inputVariant: 'compact' | 'full';
  items: DisplayedActivityFeedItem[];
  onCommentDelete: (item: GroupActivityNote) => Promise<void>;
  onCommentUpdate: (item: GroupActivityNote, data: NoteType) => Promise<void>;
  children?: React.ReactNode;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityFeed({
  items,
  children,
  group,
  inputVariant,
  onCommentDelete,
  onCommentUpdate,
  timestampUnitStyle,
}: ActivityFeedProps) {
  function renderActivity(item: DisplayedActivityFeedItem): React.ReactNode {
    const {activity} = item;
    const key = isActivityNote(activity)
      ? `comment:${activity.commentId}`
      : `activity:${activity.id}`;

    if (item.type === 'collapsed_status_activities') {
      return (
        <CollapsedStatusActivityRow key={key} eventCount={item.activities.length}>
          {item.activities.map(renderActivity)}
        </CollapsedStatusActivityRow>
      );
    }

    if (isActivityNote(activity)) {
      return (
        <ActivityLineNote
          key={key}
          activity={activity}
          inputVariant={inputVariant}
          onDelete={() => onCommentDelete(activity)}
          onUpdate={data => onCommentUpdate(activity, data)}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    }

    return (
      <ActivityLine
        key={key}
        item={item}
        group={group}
        timestampUnitStyle={timestampUnitStyle}
      />
    );
  }

  return (
    <ActivityLineList data-test-id="activity-timeline">
      {items.map(renderActivity)}
      {children}
    </ActivityLineList>
  );
}
