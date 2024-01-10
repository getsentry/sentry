import {Fragment, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import {
  Group,
  GroupActivity,
  GroupActivityNote,
  GroupActivityType,
  User,
} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {uniqueId} from 'sentry/utils/guid';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';

type Props = {
  group: Group;
  mutators: {
    addComment: (note: NoteType, activity: GroupActivity[], options?: any) => void;
    deleteComment: (noteId: string, activity: GroupActivity[], options?: any) => void;
    updateComment: (
      note: NoteType,
      noteId: string,
      activity: GroupActivity[],
      options?: any
    ) => void;
  };
  placeholderText: string;
  addMutationOptions?: {
    onError: () => void;
    onSuccess: () => void;
  };
  deleteMutationOptions?: {
    onError: () => void;
    onSuccess: () => void;
  };
  issueActivity?: boolean;
  updateMutationOptions?: {
    onError: () => void;
    onSuccess: () => void;
  };
};

function ActivitySection(props: Props) {
  const {
    group,
    placeholderText,
    mutators,
    updateMutationOptions,
    deleteMutationOptions,
    addMutationOptions,
    issueActivity,
  } = props;
  const organization = useOrganization();
  const {addComment, updateComment, deleteComment} = mutators;

  const [inputId, setInputId] = useState(uniqueId());

  const me = ConfigStore.get('user');
  const projectSlugs = group && group.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 140,
    group,
    projectSlugs,
    placeholder: placeholderText,
  };

  return (
    <Fragment>
      <ActivityItem noPadding author={{type: 'user', user: me}}>
        <NoteInputWithStorage
          key={inputId}
          storageKey="groupinput:latest"
          itemKey={group.id}
          onCreate={n => {
            const newActivity: GroupActivityNote = {
              id: group.activity[0].id + 1, // fix
              data: n,
              type: GroupActivityType.NOTE,
              dateCreated: new Date().toISOString(),
              project: group.project,
              user: me,
            };
            // need to get actual note returned from endpoint
            issueActivity
              ? GroupStore.addActivity(group.id, newActivity)
              : addComment(n, [newActivity, ...group.activity], addMutationOptions);
            setInputId(uniqueId());
          }}
          {...noteProps}
        />
      </ActivityItem>

      {group.activity.map(item => {
        const authorName = item.user ? item.user.name : 'Sentry';

        if (item.type === GroupActivityType.NOTE) {
          return (
            <ErrorBoundary mini key={`note-${item.id}`}>
              <Note
                showTime={false}
                text={item.data.text}
                noteId={item.id}
                user={item.user as User}
                dateCreated={item.dateCreated}
                authorName={authorName}
                onDelete={() => {
                  deleteComment(
                    item.id,
                    group.activity.filter(a => a.id !== item.id),
                    deleteMutationOptions
                  );
                  if (issueActivity) {
                    const restore = group.activity.find(
                      activity => activity.id === item.id
                    );
                    const index = GroupStore.removeActivity(group.id, item.id);

                    if (index === -1 || restore === undefined) {
                      addErrorMessage(t('Failed to delete comment'));
                    }
                  }
                }}
                onUpdate={n => {
                  item.data.text = n.text;
                  updateComment(n, item.id, group.activity, {
                    ...updateMutationOptions,
                    onMutate: () =>
                      issueActivity
                        ? GroupStore.updateActivity(group.id, item.id, {text: n.text})
                        : undefined,
                  });
                }}
                {...noteProps}
              />
            </ErrorBoundary>
          );
        }

        return (
          <ErrorBoundary mini key={`item-${item.id}`}>
            <ActivityItem
              author={{
                type: item.user ? 'user' : 'system',
                user: item.user ?? undefined,
              }}
              date={item.dateCreated}
              header={
                <GroupActivityItem
                  author={<ActivityAuthor>{authorName}</ActivityAuthor>}
                  activity={item}
                  organization={organization}
                  projectId={group.project.id}
                />
              }
            />
          </ErrorBoundary>
        );
      })}
    </Fragment>
  );
}

export default ActivitySection;
