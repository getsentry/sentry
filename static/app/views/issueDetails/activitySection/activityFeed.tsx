import type {TimeSince} from 'sentry/components/timeSince';
import type {NoteType} from 'sentry/types/alerts';
import type {Group, GroupActivityNote} from 'sentry/types/group';

import {
  getActorActivity,
  type ActivityFeedItem,
  type DisplayedActivityFeedItem,
} from './activityLineItem/activityFeedItem';
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
  highlightedActivityId?: string;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityFeed({
  items,
  children,
  group,
  highlightedActivityId,
  inputVariant,
  onCommentDelete,
  onCommentUpdate,
  timestampUnitStyle,
}: ActivityFeedProps) {
  function isHighlighted(item: ActivityFeedItem) {
    return (
      highlightedActivityId !== undefined &&
      (item.activity.id === highlightedActivityId ||
        getActorActivity(item).id === highlightedActivityId)
    );
  }

  function renderActivity(item: DisplayedActivityFeedItem): React.ReactNode {
    if (item.type === 'collapsed_status_activities') {
      const containsHighlight = item.activities.some(isHighlighted);
      const key = `activity:${item.activity.id}`;
      return (
        <CollapsedStatusActivityRow
          key={containsHighlight ? `${key}:${highlightedActivityId}` : key}
          defaultExpanded={containsHighlight}
          eventCount={item.activities.length}
        >
          {item.activities.map(renderActivity)}
        </CollapsedStatusActivityRow>
      );
    }

    const {activity} = item;
    const key = isActivityNote(activity)
      ? `comment:${activity.commentId}`
      : `activity:${activity.id}`;

    let line: React.ReactNode;
    if (isActivityNote(activity)) {
      line = (
        <ActivityLineNote
          activity={activity}
          inputVariant={inputVariant}
          onDelete={() => onCommentDelete(activity)}
          onUpdate={data => onCommentUpdate(activity, data)}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    } else if (isImpactActivity(activity)) {
      line = (
        <ActivityLineImpact
          activity={activity}
          group={group}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    } else if (isInvestigationLinkedActivity(activity)) {
      line = (
        <ActivityLineInvestigationLinked
          activity={activity}
          variant={inputVariant}
          timestampUnitStyle={timestampUnitStyle}
        />
      );
    } else {
      line = (
        <ActivityLine item={item} group={group} timestampUnitStyle={timestampUnitStyle}>
          {item.body}
        </ActivityLine>
      );
    }

    return (
      <Timeline.Highlight
        key={key}
        value={isHighlighted(item) ? highlightedActivityId : undefined}
      >
        {line}
      </Timeline.Highlight>
    );
  }

  return (
    <Timeline.Container data-test-id="activity-timeline">
      {items.map(renderActivity)}
      {children}
    </Timeline.Container>
  );
}
