import {Fragment, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {ActivityAuthor} from 'sentry/components/activity/author';
import {ActivityItem} from 'sentry/components/activity/item';
import {Note} from 'sentry/components/activity/note';
import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {
  Group,
  GroupActivityNote,
  GroupActivityReprocess,
  GroupActivityType,
  Note as NoteType,
  Organization,
  User,
} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import GroupActivityItem from 'sentry/views/issueDetails/groupActivityItem';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

// This file is based on issueDetails/groupActivity.tsx

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
};

function deleteNote({
  group,
  id,
  organization,
  api,
  deleteComment,
}: {
  api: Client;
  deleteComment;
  group: Group;
  id: string;
  organization: Organization;
}) {
  const promise = api.requestPromise(
    `/organizations/${organization.slug}/issues/${group.id}/comments/${id}/`,
    {
      method: 'DELETE',
    }
  );

  const newActivity = group.activity.filter(a => a.id !== id);
  deleteComment(newActivity);

  return promise;
}

function createNote({
  group,
  note,
  organization,
  api,
  addComment,
  author,
}: {
  addComment;
  api: Client;
  author: User;
  group: Group;
  note: NoteType;
  organization: Organization;
}) {
  const promise = api.requestPromise(
    `/organizations/${organization.slug}/issues/${group.id}/comments/`,
    {
      method: 'POST',
      data: note,
    }
  );

  const newActivity: GroupActivityNote = {
    id: '',
    data: {text: note.text},
    type: GroupActivityType.NOTE,
    dateCreated: new Date().toISOString(),
    project: group.project,
    user: author,
  };
  addComment([newActivity, ...group.activity]);

  return promise;
}

function updateNote({
  group,
  note,
  id,
  api,
  updateComment,
  organization,
}: {
  api: Client;
  group: Group;
  id: string;
  note: NoteType;
  organization: Organization;
  updateComment;
}) {
  const promise = api.requestPromise(
    `/organizations/${organization.slug}/issues/${group.id}/comments/${id}/`,
    {
      method: 'PUT',
      data: note,
    }
  );

  const idx = group.activity.findIndex(a => a.id === id);

  if (idx !== -1) {
    const oldActivityItem = group.activity[idx] as GroupActivityNote;
    const newActivity = Object.assign([...group.activity], {
      [idx]: {...oldActivityItem, data: {...oldActivityItem.data, text: note.text}},
    });
    updateComment(newActivity);
  }

  return promise;
}

const handleNoteDelete = async ({id, group, organization, api, deleteComment}) => {
  addLoadingMessage(t('Removing comment\u{2026}'));

  try {
    await deleteNote({group, id, organization, api, deleteComment});
    clearIndicators();
  } catch (_err) {
    addErrorMessage(t('Failed to delete comment'));
  }
};

const handleNoteCreate = async ({note, group, organization, api, addComment, author}) => {
  addLoadingMessage(t('Posting comment\u{2026}'));

  try {
    await createNote({group, note, organization, api, addComment, author});
    clearIndicators();
  } catch (error) {
    addErrorMessage(t('Unable to post comment'));
  }
};

const handleNoteUpdate = async ({note, id, group, api, updateComment, organization}) => {
  addLoadingMessage(t('Updating comment\u{2026}'));

  try {
    await updateNote({group, note, id, updateComment, api, organization});
    clearIndicators();
  } catch (error) {
    addErrorMessage(t('Unable to update comment'));
  }
};

function CommentsSection(props: Props) {
  const {group, organization, api} = props;
  const {activity: activities, count, id: groupId} = group;
  const groupCount = Number(count);
  const mostRecentActivity = getGroupMostRecentActivity(activities);
  const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);

  const {mutateComments} = useMutateFeedback({
    feedbackIds: [group.id],
    organization,
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
                handleNoteCreate({
                  note: n,
                  group,
                  organization,
                  api,
                  addComment: mutateComments,
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
                    onDelete={() =>
                      handleNoteDelete({
                        id: item.id,
                        group,
                        organization,
                        api,
                        deleteComment: mutateComments,
                      })
                    }
                    onUpdate={n =>
                      handleNoteUpdate({
                        note: n,
                        id: item.id,
                        group,
                        api,
                        updateComment: mutateComments,
                        organization,
                      })
                    }
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

export default withApi(withOrganization(CommentsSection));
