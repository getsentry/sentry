import {useState} from 'react';
import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import {GroupActivityType, type GroupActivity} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivityInputFrame} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';

import {getActivityNoteAuthor} from './activityItem';
import {ActivityLineContent, ActivityLineRow, type ActivityLineVariant} from './layout';
import {ActivityLineMarker} from './progressMarker';

type GroupActivityNote = Extract<GroupActivity, {type: GroupActivityType.NOTE}>;

interface ActivityLineNoteProps {
  activity: GroupActivityNote;
  inputVariant: ActivityLineVariant;
  onDelete: () => Promise<void>;
  onUpdate: (data: NoteType) => Promise<void>;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function isActivityNote(activity: GroupActivity): activity is GroupActivityNote {
  return activity.type === GroupActivityType.NOTE;
}

export function ActivityLineNote({
  activity,
  inputVariant,
  onDelete,
  onUpdate,
  timestampUnitStyle,
}: ActivityLineNoteProps) {
  const [editing, setEditing] = useState(false);
  const organization = useOrganization();
  const showProgress = organization.features.includes('issue-activity-progress');
  const timestamp = (
    <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
  );
  return (
    <ActivityLineRow>
      <ActivityLineMarker item={activity} showProgress={showProgress} />
      <ActivityLineNoteHeadline
        title={t('%s commented', getActivityNoteAuthor(activity))}
        timestamp={timestamp}
        variant={inputVariant}
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
          <ActivityInputFrame>
            <MentionComposer
              initialValue={activity.data.text}
              minHeight={96}
              mode="edit"
              onCancel={() => setEditing(false)}
              onSubmit={async data => {
                await onUpdate(data);
                setEditing(false);
              }}
              variant={inputVariant}
            />
          </ActivityInputFrame>
        ) : (
          <ActivityNoteBubble>
            <NoteBody text={activity.data.text} />
          </ActivityNoteBubble>
        )}
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

function ActivityLineNoteHeadline({
  title,
  timestamp,
  actions,
  variant,
}: {
  timestamp: React.ReactNode;
  title: React.ReactNode;
  variant: ActivityLineVariant;
  actions?: React.ReactNode;
}) {
  return (
    <ActivityLineNoteHeadlineLayout
      column={2}
      row={1}
      columns={variant === 'compact' ? 'minmax(0, 1fr)' : 'minmax(0, max-content) auto'}
      minWidth={0}
      minHeight="22px"
      align="center"
      gap="xs"
      data-compact={variant === 'compact' ? true : undefined}
    >
      <ActivityLineNoteSentence data-compact={variant === 'compact' ? true : undefined}>
        <ActivityLineNoteTitle
          as="span"
          bold
          density="comfortable"
          wordBreak="break-word"
        >
          {title}
        </ActivityLineNoteTitle>{' '}
        <ActivityLineNoteMeta>
          <Text as="span" variant="muted" density="comfortable">
            &bull;
          </Text>
          <Text as="span" variant="muted" density="comfortable" wrap="nowrap">
            {timestamp}
          </Text>
        </ActivityLineNoteMeta>
      </ActivityLineNoteSentence>
      {actions ? (
        <ActivityLineNoteActions data-compact={variant === 'compact' ? true : undefined}>
          {actions}
        </ActivityLineNoteActions>
      ) : null}
    </ActivityLineNoteHeadlineLayout>
  );
}

const ActivityLineNoteHeadlineLayout = styled(Grid)`
  position: relative;
  justify-self: start;
  max-width: 100%;

  &[data-compact='true'] {
    justify-self: stretch;
  }
`;

const ActivityLineNoteSentence = styled('span')`
  align-self: start;
  min-width: 0;
  overflow-wrap: anywhere;

  &[data-compact='true'] {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    padding-right: ${p => p.theme.space.xl};
  }
`;

const ActivityLineNoteTitle = styled(Text)`
  overflow-wrap: anywhere;
`;

const ActivityLineNoteMeta = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

const ActivityLineNoteActions = styled('span')`
  display: inline-grid;
  place-items: center;

  &[data-compact='true'] {
    position: absolute;
    top: 0;
    right: 0;
  }
`;

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
