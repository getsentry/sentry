import {useState} from 'react';
import styled from '@emotion/styled';

import ActivityItem, {ActivityAuthorType} from 'sentry/components/activity/item';
import {space} from 'sentry/styles/space';
import {User} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {ActivityType} from 'sentry/views/alerts/types';

import NoteBody from './body';
import EditorTools from './editorTools';
import NoteHeader from './header';
import NoteInput from './input';

type Props = {
  /**
   * String for author name to be displayed in header.
   *
   * This is not completely derived from `props.user` because we can set a
   * default from parent component
   */
  authorName: string;
  dateCreated: Date | string;
  /**
   * min-height for NoteInput textarea
   */
  minHeight: number;
  /**
   * This is the id of the note object from the server. This is to indicate you
   * are editing an existing item
   */
  noteId: string;
  onDelete: (props: Props) => void;
  onUpdate: (data: NoteType, props: Props) => void;
  /**
   * If used, will fetch list of teams/members that can be mentioned for projects
   */
  projectSlugs: string[];
  /**
   * Pass through to ActivityItem. Shows absolute time instead of a relative
   * string
   */
  showTime: boolean;
  /**
   * The note text itself
   */
  text: string;
  user: User;
  /**
   * This is unusual usage that Alert Details uses to get back the activity
   * that an input was bound to as the onUpdate and onDelete actions forward
   * this component's props.
   */
  activity?: ActivityType;
  /**
   * pass through to ActivityItem. Hides the date/timestamp in header
   */
  hideDate?: boolean;
  onCreate?: (data: NoteType) => void;
};

const Note = (props: Props) => {
  const [editing, setEditing] = useState(false);

  const {
    noteId,
    user,
    dateCreated,
    text,
    authorName,
    hideDate,
    minHeight,
    showTime,
    projectSlugs,
    onDelete,
    onCreate,
    onUpdate,
  } = props;

  const activityItemProps = {
    hideDate,
    showTime,
    id: `activity-item-${noteId}`,
    author: {
      type: 'user' as ActivityAuthorType,
      user,
    },
    date: dateCreated,
  };

  if (!editing) {
    const header = (
      <NoteHeader
        {...{authorName, user}}
        onEdit={() => setEditing(true)}
        onDelete={() => onDelete(props)}
      />
    );

    return (
      <ActivityItemWithEditing {...activityItemProps} header={header}>
        <NoteBody text={text} />
      </ActivityItemWithEditing>
    );
  }

  // When editing, `NoteInput` has its own header, pass render func to control
  // rendering of bubble body
  return (
    <ActivityItemNote {...activityItemProps}>
      {() => (
        <NoteInput
          {...{noteId, minHeight, text, projectSlugs}}
          onEditFinish={() => setEditing(false)}
          onUpdate={note => {
            onUpdate(note, props);
            setEditing(false);
          }}
          onCreate={note => onCreate?.(note)}
        />
      )}
    </ActivityItemNote>
  );
};

const ActivityItemNote = styled(ActivityItem)`
  /* this was nested under ".activity-note.activity-bubble" */
  ul {
    list-style: disc;
  }

  h1,
  h2,
  h3,
  h4,
  p,
  ul:not(.nav),
  ol,
  pre,
  hr,
  blockquote {
    margin-bottom: ${space(2)};
  }

  ul,
  ol {
    padding-left: 20px;
  }

  p {
    a {
      word-wrap: break-word;
    }
  }

  blockquote {
    font-size: 15px;
    border-left: 5px solid ${p => p.theme.innerBorder};
    padding-left: ${space(1)};
    margin-left: 0;
  }
`;

const ActivityItemWithEditing = styled(ActivityItemNote)`
  &:hover {
    ${EditorTools} {
      display: inline-block;
    }
  }
`;

export default Note;
