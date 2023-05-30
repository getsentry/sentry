import {useState} from 'react';

import {ActivityAuthorType, ActivityItem} from 'sentry/components/activity/item';
import {User} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {ActivityType} from 'sentry/views/alerts/types';

import {NoteBody} from './body';
import {NoteHeader} from './header';
import {NoteInput} from './input';

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

function Note(props: Props) {
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

  if (editing) {
    return (
      <ActivityItem noPadding {...activityItemProps}>
        <NoteInput
          {...{noteId, minHeight, text, projectSlugs}}
          onEditFinish={() => setEditing(false)}
          onUpdate={note => {
            onUpdate(note, props);
            setEditing(false);
          }}
          onCreate={note => onCreate?.(note)}
        />
      </ActivityItem>
    );
  }

  const header = (
    <NoteHeader
      user={user}
      authorName={authorName}
      onEdit={() => setEditing(true)}
      onDelete={() => onDelete(props)}
    />
  );

  return (
    <ActivityItem {...activityItemProps} header={header}>
      <NoteBody text={text} />
    </ActivityItem>
  );
}

export {Note};
