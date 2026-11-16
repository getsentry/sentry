import type {TimeSince} from 'sentry/components/timeSince';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivityNote} from 'sentry/types/group';

import type {DisplayedActivityFeedItem} from './activityLineItem/activityFeedItem';
import {CollapsedStatusActivityRow} from './activityLineItem/collapsedStatusActivityRow';
import {ActivityLineImpact, isImpactActivity} from './activityLineItem/impact';
import {
  ActivityLineInvestigationLinked,
  isInvestigationLinkedActivity,
} from './activityLineItem/investigationLinked';
import {ActivityLineNote, isActivityNote} from './activityLineItem/note';
import {ActivityLine} from './activityLineItem';
import {Timeline} from './timeline';

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

    if (isImpactActivity(activity)) {
      return (
        <ActivityLineImpact
          key={key}
          activity={activity}
          group={group}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    }

    if (isInvestigationLinkedActivity(activity)) {
      return (
        <ActivityLineInvestigationLinked
          key={key}
          activity={activity}
          variant={inputVariant}
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
      >
        {item.body}
      </ActivityLine>
    );
  }

  return (
    <Timeline.Container data-test-id="activity-timeline">
      {items.map(renderActivity)}
      {children}
    </Timeline.Container>
  );
}
