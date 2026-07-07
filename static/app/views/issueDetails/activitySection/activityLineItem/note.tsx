import {useState} from 'react';
import styled from '@emotion/styled';

import {NoteBody} from 'sentry/components/activity/note/body';
import {TimeSince} from 'sentry/components/timeSince';
import {GroupActivityType, type Group, type GroupActivity} from 'sentry/types/group';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';

import {ActivityLineActor} from './actor';
import {
  ActivityLineContent,
  ActivityLineHeadline,
  ActivityLineRow,
  type ActivityLineVariant,
} from './layout';
import {ActivityLineMarker} from './progressMarker';

type GroupActivityNote = Extract<GroupActivity, {type: GroupActivityType.NOTE}>;

interface ActivityLineNoteProps {
  activity: GroupActivityNote;
  group: Group;
  inputVariant: ActivityLineVariant;
  onDelete: () => Promise<void>;
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function isActivityNote(activity: GroupActivity): activity is GroupActivityNote {
  return activity.type === GroupActivityType.NOTE;
}

function getNoteAuthorName(activity: GroupActivityNote) {
  if (activity.sentry_app) {
    return activity.sentry_app.name;
  }

  return activity.user?.name ?? 'Sentry';
}

export function ActivityLineNote({
  activity,
  group,
  inputVariant,
  onDelete,
  onCommentEdited,
  timestampUnitStyle,
}: ActivityLineNoteProps) {
  const [editing, setEditing] = useState(false);
  const timestamp = (
    <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
  );

  return (
    <ActivityLineRow variant={inputVariant}>
      <ActivityLineMarker item={activity} />
      <ActivityLineActor item={activity} />
      <ActivityLineHeadline
        title={getNoteAuthorName(activity)}
        timestamp={timestamp}
        actions={
          !editing && (
            <CommentActionsDropdown
              onDelete={onDelete}
              onEdit={() => setEditing(true)}
              user={activity.user}
            />
          )
        }
      />
      <ActivityLineContent>
        {editing ? (
          <ActivityNoteInput
            itemKey={activity.id}
            storageKey={`groupinput:${activity.id}`}
            minHeight={96}
            variant={inputVariant}
            text={activity.data.text}
            noteId={activity.id}
            group={group}
            onCommentEdited={updatedActivity => {
              onCommentEdited?.(updatedActivity);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ActivityNoteBubble>
            <NoteBody text={activity.data.text} />
          </ActivityNoteBubble>
        )}
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

const ActivityNoteBubble = styled('div')`
  display: block;
  width: 100%;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.45;

  [data-test-id='activity-note-body'] p {
    margin: 0;
  }

  [data-test-id='activity-note-body'] p + p {
    margin-top: ${p => p.theme.space.sm};
  }
`;
