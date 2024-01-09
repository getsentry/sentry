import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useMutateFeedbackActivity, {
  TContext,
  TData,
  TError,
  TVariables,
} from 'sentry/components/feedback/useMutateFeedbackActivity';
import * as Layout from 'sentry/components/layouts/thirds';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {
  Group,
  GroupActivity,
  GroupActivityNote,
  GroupActivityReprocess,
  GroupActivityType,
  User,
} from 'sentry/types';
import {NoteType} from 'sentry/types/alerts';
import {uniqueId} from 'sentry/utils/guid';
import {MutateOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

// This file is based on issueDetails/groupActivity.tsx

type Props = {
  group: Group;
};

function deleteNote({
  id,
  deleteComment,
  group,
}: {
  deleteComment: (
    noteId: string,
    activity: GroupActivity[],
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ) => void;
  group: Group;
  id: string;
}) {
  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while removing the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment removed'));
    },
  };

  // For cache purposes
  const newActivity = group.activity.filter(a => a.id !== id);
  deleteComment(id, newActivity, mutationOptions);
}

function createNote({
  note,
  addComment,
  group,
  author,
}: {
  addComment: (
    note: NoteType,
    activity: GroupActivity[],
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ) => void;
  author: User;
  group: Group;
  note: NoteType;
}) {
  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while posting the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment posted'));
    },
  };

  // For cache purposes
  const newActivity: GroupActivityNote = {
    id: '',
    data: note,
    type: GroupActivityType.NOTE,
    dateCreated: new Date().toISOString(),
    project: group.project,
    user: author,
  };
  addComment(note, [newActivity, ...group.activity], mutationOptions);
}

function updateNote({
  note,
  id,
  updateComment,
  group,
}: {
  group: Group;
  id: string;
  note: NoteType;
  updateComment: (
    note: NoteType,
    noteId: string,
    activity: GroupActivity[],
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ) => void;
}) {
  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment updated'));
    },
  };

  // For cache purposes
  const idx = group.activity.findIndex(a => a.id === id);

  if (idx !== -1) {
    const oldActivityItem = group.activity[idx] as GroupActivityNote;
    const newActivity = Object.assign([...group.activity], {
      [idx]: {...oldActivityItem, data: note},
    });
    updateComment(note, id, newActivity, mutationOptions);
  } else {
    updateComment(note, id, group.activity, mutationOptions);
  }
}

function ActivitySection(props: Props) {
  const {group} = props;
  const organization = useOrganization();
  const {activity: activities, count, id: groupId} = group;
  const groupCount = Number(count);
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);

  const {addComment, deleteComment, updateComment} = useMutateFeedbackActivity({
    organization,
    group,
  });

  const [inputId, setInputId] = useState(uniqueId());

  const me = ConfigStore.get('user');
  const projectSlugs = group && group.project ? [group.project.slug] : [];
  const noteProps = {
    minHeight: 140,
    group,
    projectSlugs,
    placeholder: t(
      'Add details or updates to this feedback. \nTag users with @, or teams with #'
    ),
  };

  return (
    <Fragment>
      {(reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT ||
        reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HAS_EVENT) && (
        <ReprocessedBox
          reprocessActivity={mostRecentActivity as GroupActivityReprocess}
          groupCount={groupCount}
          orgSlug={organization.slug}
          groupId={groupId}
        />
      )}

      <Layout.Body>
        <Layout.Main>
          <ActivityItem noPadding author={{type: 'user', user: me}}>
            <NoteInputWithStorage
              key={inputId}
              storageKey="groupinput:latest"
              itemKey={group.id}
              onCreate={n => {
                createNote({
                  note: n,
                  addComment,
                  group,
                  author: me,
                });
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
                      deleteNote({
                        id: item.id,
                        deleteComment,
                        group,
                      });
                    }}
                    onUpdate={n => {
                      updateNote({
                        note: n,
                        id: item.id,
                        updateComment,
                        group,
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
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default ActivitySection;
