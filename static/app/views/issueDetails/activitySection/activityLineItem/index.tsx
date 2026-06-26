import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {NoteBody} from 'sentry/components/activity/note/body';
import {TimeSince} from 'sentry/components/timeSince';
import {GroupActivityType, type Group, type GroupActivity} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';
import {CommentActionsDropdown} from 'sentry/views/issueDetails/activitySection/commentActionsDropdown';

import {ActivityLineActor} from './actor';
import {getCompactGroupActivityItem} from './compactActivityItem';
import {ActivityLineMarker} from './marker';

interface ActivityLineItemProps {
  editing: boolean;
  group: Group;
  handleDelete: (item: GroupActivity) => Promise<void>;
  inputVariant: 'compact' | 'full';
  item: GroupActivity;
  setEditing: (editing: boolean) => void;
  teams: Team[];
  onCommentEdited?: (activity: GroupActivity[]) => void;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityLineItem({
  item,
  handleDelete,
  onCommentEdited,
  group,
  teams,
  inputVariant,
  timestampUnitStyle,
  editing,
  setEditing,
}: ActivityLineItemProps) {
  const organization = useOrganization();
  const compactItem = getCompactGroupActivityItem(
    item,
    organization,
    group.project,
    group.issueCategory,
    teams
  );

  return (
    <ActivityLineRow $isCompactLayout={inputVariant === 'compact'}>
      <ActivityLineMarker item={item} />
      <ActivityLineActor item={item} />
      <Flex
        column={3}
        row={1}
        minWidth={0}
        minHeight={22}
        align="center"
        wrap="wrap"
        gap="xs"
      >
        <ActivityLineTitle>{compactItem.title}</ActivityLineTitle>
        {compactItem.details && (
          <ActivityLineDetails>{compactItem.details}</ActivityLineDetails>
        )}
        <ActivityLineMeta>
          <ActivityLineMutedText>&bull;</ActivityLineMutedText>
          <ActivityLineTimestamp>
            <TimeSince date={item.dateCreated} unitStyle={timestampUnitStyle} />
          </ActivityLineTimestamp>
          {item.type === GroupActivityType.NOTE && !editing && (
            <CommentActionsDropdown
              onDelete={() => handleDelete(item)}
              onEdit={() => setEditing(true)}
              user={item.user}
            />
          )}
        </ActivityLineMeta>
      </Flex>
      <ActivityLineContent>
        {item.type === GroupActivityType.NOTE && editing ? (
          <ActivityNoteInput
            itemKey={item.id}
            storageKey={`groupinput:${item.id}`}
            minHeight={96}
            variant={inputVariant}
            text={item.data.text}
            noteId={item.id}
            group={group}
            onCommentEdited={activity => {
              onCommentEdited?.(activity);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : compactItem.body ? (
          <ActivityNoteBubble>
            <NoteBody text={compactItem.body} />
          </ActivityNoteBubble>
        ) : compactItem.subtext ? (
          <ActivityLineSubtext>{compactItem.subtext}</ActivityLineSubtext>
        ) : null}
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

const ActivityLineRow = styled('div')<{$isCompactLayout: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: 22px 22px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;
  column-gap: ${p => (p.$isCompactLayout ? p.theme.space.sm : p.theme.space.md)};
  margin: 12px 0;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;

    &::after {
      content: '';
      position: absolute;
      z-index: 1;
      left: 10.5px;
      top: 22px;
      bottom: 0;
      width: 1px;
      background: ${p => p.theme.tokens.background.overlay};
    }
  }
`;

const ActivityLineDetails = styled('span')`
  display: contents;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ActivityLineTitle = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ActivityLineMutedText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
`;

const ActivityLineTimestamp = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  white-space: nowrap;
`;

const ActivityLineMeta = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

const ActivityLineContent = styled('div')`
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  margin-top: ${p => p.theme.space.sm};

  &:empty {
    display: none;
  }
`;

const ActivityLineSubtext = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ActivityNoteBubble = styled('div')`
  display: inline-block;
  max-width: 100%;
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
