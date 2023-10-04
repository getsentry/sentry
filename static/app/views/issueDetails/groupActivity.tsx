import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {createNote, deleteNote, updateNote} from 'sentry/actionCreators/group';
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
import {CreateError} from 'sentry/components/activity/note/types';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import {DEFAULT_ERROR_JSON} from 'sentry/constants';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {
  Group,
  GroupActivityReprocess,
  GroupActivityType,
  Organization,
  User,
} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import GroupActivityItem from './groupActivityItem';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from './utils';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type State = {
  createBusy: boolean;
  error: boolean;
  errorJSON: CreateError | null;
  inputId: string;
};

class GroupActivity extends Component<Props, State> {
  // TODO(dcramer): only re-render on group/activity change
  state: State = {
    createBusy: false,
    error: false,
    errorJSON: null,
    inputId: uniqueId(),
  };

  handleNoteDelete = async ({noteId, text: oldText}) => {
    const {api, group, organization} = this.props;

    addLoadingMessage(t('Removing comment\u{2026}'));

    try {
      await deleteNote(api, organization.slug, group, noteId, oldText);
      clearIndicators();
    } catch (_err) {
      addErrorMessage(t('Failed to delete comment'));
    }
  };

  /**
   * Note: This is nearly the same logic as `app/views/alerts/details/activity`
   * This can be abstracted a bit if we create more objects that can have activities
   */
  handleNoteCreate = async note => {
    const {api, group, organization} = this.props;

    this.setState({
      createBusy: true,
    });

    addLoadingMessage(t('Posting comment\u{2026}'));

    try {
      await createNote(api, organization.slug, group, note);

      this.setState({
        createBusy: false,

        // This is used as a `key` to Note Input so that after successful post
        // we reset the value of the input
        inputId: uniqueId(),
      });
      clearIndicators();
    } catch (error) {
      this.setState({
        createBusy: false,
        error: true,
        errorJSON: error.responseJSON || DEFAULT_ERROR_JSON,
      });
      addErrorMessage(t('Unable to post comment'));
    }
  };

  handleNoteUpdate = async (note, {noteId, text: oldText}) => {
    const {api, group, organization} = this.props;

    addLoadingMessage(t('Updating comment\u{2026}'));

    try {
      await updateNote(api, organization.slug, group, note, noteId, oldText);
      clearIndicators();
    } catch (error) {
      this.setState({
        error: true,
        errorJSON: error.responseJSON || DEFAULT_ERROR_JSON,
      });
      addErrorMessage(t('Unable to update comment'));
    }
  };

  render() {
    const {group, organization} = this.props;
    const {activity: activities, count, id: groupId} = group;
    const groupCount = Number(count);
    const mostRecentActivity = getGroupMostRecentActivity(activities);
    const reprocessingStatus = getGroupReprocessingStatus(group, mostRecentActivity);

    const me = ConfigStore.get('user');
    const projectSlugs = group && group.project ? [group.project.slug] : [];
    const noteProps = {
      minHeight: 140,
      group,
      projectSlugs,
      placeholder: t(
        'Add details or updates to this event. \nTag users with @, or teams with #'
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
                key={this.state.inputId}
                storageKey="groupinput:latest"
                itemKey={group.id}
                onCreate={this.handleNoteCreate}
                busy={this.state.createBusy}
                error={this.state.error}
                errorJSON={this.state.errorJSON}
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
                      onDelete={this.handleNoteDelete}
                      onUpdate={this.handleNoteUpdate}
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
}

export {GroupActivity};
export default withApi(withOrganization(GroupActivity));
