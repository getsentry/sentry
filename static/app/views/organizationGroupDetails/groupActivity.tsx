import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {createNote, deleteNote, updateNote} from 'app/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import ActivityAuthor from 'app/components/activity/author';
import ActivityItem from 'app/components/activity/item';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import {CreateError} from 'app/components/activity/note/types';
import ErrorBoundary from 'app/components/errorBoundary';
import ReprocessedBox from 'app/components/reprocessedBox';
import {DEFAULT_ERROR_JSON} from 'app/constants';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {
  Group,
  GroupActivityReprocess,
  GroupActivityType,
  Organization,
  User,
} from 'app/types';
import {uniqueId} from 'app/utils/guid';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import GroupActivityItem from './groupActivityItem';
import {
  getGroupMostRecentActivity,
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from './utils';

type Props = {
  api: Client;
  organization: Organization;
  group: Group;
} & RouteComponentProps<{orgId: string}, {}>;

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

  handleNoteDelete = async ({modelId, text: oldText}) => {
    const {api, group} = this.props;

    addLoadingMessage(t('Removing comment...'));

    try {
      await deleteNote(api, group, modelId, oldText);
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
    const {api, group} = this.props;

    this.setState({
      createBusy: true,
    });

    addLoadingMessage(t('Posting comment...'));

    try {
      await createNote(api, group, note);

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

  handleNoteUpdate = async (note, {modelId, text: oldText}) => {
    const {api, group} = this.props;

    addLoadingMessage(t('Updating comment...'));

    try {
      await updateNote(api, group, note, modelId, oldText);
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
          <StyledReprocessedBox
            reprocessActivity={mostRecentActivity as GroupActivityReprocess}
            groupCount={groupCount}
            orgSlug={organization.slug}
            groupId={groupId}
          />
        )}
        <div className="row">
          <div className="col-md-9">
            <div>
              <ActivityItem author={{type: 'user', user: me}}>
                {() => (
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
                )}
              </ActivityItem>

              {group.activity.map(item => {
                const authorName = item.user ? item.user.name : 'Sentry';

                if (item.type === GroupActivityType.NOTE) {
                  return (
                    <ErrorBoundary mini key={`note-${item.id}`}>
                      <Note
                        showTime={false}
                        text={item.data.text}
                        modelId={item.id}
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
                          orgSlug={this.props.params.orgId}
                          projectId={group.project.id}
                        />
                      }
                    />
                  </ErrorBoundary>
                );
              })}
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

export {GroupActivity};
export default withApi(withOrganization(GroupActivity));

const StyledReprocessedBox = styled(ReprocessedBox)`
  margin: -${space(3)} -${space(4)} ${space(4)} -${space(4)};
  z-index: 1;
`;
