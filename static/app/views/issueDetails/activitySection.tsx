import {Fragment, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  AddCommentCallback,
  DeleteCommentCallback,
  TContext,
  TData,
  TError,
  TVariables,
  UpdateCommentCallback,
} from 'sentry/components/feedback/useMutateActivity';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import {Group, GroupActivityNote, GroupActivityType, User} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import {MutateOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';

type Props = {
  group: Group;
  mutators: {
    addComment: AddCommentCallback;
    deleteComment: DeleteCommentCallback;
    updateComment: UpdateCommentCallback;
  };
  placeholderText: string;
  addMutationOptions?: MutateOptions<TData, TError, TVariables, TContext>;
  deleteMutationOptions?: MutateOptions<TData, TError, TVariables, TContext>;
  updateMutationOptions?: MutateOptions<TData, TError, TVariables, TContext>;
};

function ActivitySection(props: Props) {
  const {
    group,
    placeholderText,
    mutators,
    updateMutationOptions,
    deleteMutationOptions,
    addMutationOptions,
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
              id: uniqueId(), // temporary unique id, for cache use only
              data: n,
              type: GroupActivityType.NOTE,
              dateCreated: new Date().toISOString(),
              project: group.project,
              user: me,
            };
            addComment(n, [newActivity, ...group.activity], addMutationOptions);
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
                  // @ts-ignore
                  if (group.issueCategory !== 'feedback') {
                    const restore = group.activity.find(
                      activity => activity.id === item.id
                    );
                    const index = GroupStore.removeActivity(group.id, item.id);

                    if (index === -1 || restore === undefined) {
                      addErrorMessage(t('Failed to delete comment'));
                      return;
                    }
                  }
                  deleteComment(
                    item.id,
                    group.activity.filter(a => a.id !== item.id),
                    deleteMutationOptions
                  );
                }}
                onUpdate={n => {
                  item.data.text = n.text;
                  updateComment(n, item.id, group.activity, updateMutationOptions);
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
