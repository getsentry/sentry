import PropTypes from 'prop-types';
import {Component} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {createNote, deleteNote, updateNote} from 'app/actionCreators/group';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import ActivityAuthor from 'app/components/activity/author';
import ActivityItem from 'app/components/activity/item';
import ConfigStore from 'app/stores/configStore';
import ErrorBoundary from 'app/components/errorBoundary';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import GroupActivityItem from './groupActivityItem';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

class GroupActivity extends Component {
  // TODO(dcramer): only re-render on group/activity change
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    group: SentryTypes.Group,
  };

  state = {
    createBusy: false,
    error: false,
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
        errorJSON: error.responseJSON || makeDefaultErrorJson(),
      });
      addErrorMessage(t('Unable to post comment'));
    }
  };

  handleNoteUpdate = async (note, {modelId, text: oldText}) => {
    const {api, group} = this.props;

    this.setState({
      updateBusy: true,
    });
    addLoadingMessage(t('Updating comment...'));

    try {
      await updateNote(api, group, note, modelId, oldText);
      this.setState({
        updateBusy: false,
      });
      clearIndicators();
    } catch (error) {
      this.setState({
        updateBusy: false,
        error: true,
        errorJSON: error.responseJSON || makeDefaultErrorJson(),
      });
      addErrorMessage(t('Unable to update comment'));
    }
  };

  render() {
    const {group} = this.props;
    const me = ConfigStore.get('user');
    const projectSlugs = group && group.project ? [group.project.slug] : [];
    const noteProps = {
      group,
      projectSlugs,
      placeholder: t(
        'Add details or updates to this event. \nTag users with @, or teams with #'
      ),
    };

    return (
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

              if (item.type === 'note') {
                return (
                  <ErrorBoundary mini key={`note-${item.id}`}>
                    <Note
                      text={item.data.text}
                      modelId={item.id}
                      user={item.user}
                      dateCreated={item.dateCreated}
                      authorName={authorName}
                      onDelete={this.handleNoteDelete}
                      onUpdate={this.handleNoteUpdate}
                      busy={this.state.updateBusy}
                      {...noteProps}
                    />
                  </ErrorBoundary>
                );
              } else {
                return (
                  <ErrorBoundary mini key={`item-${item.id}`}>
                    <ActivityItem
                      item={item}
                      author={{type: item.user ? 'user' : 'system', user: item.user}}
                      date={item.dateCreated}
                      header={
                        <GroupActivityItem
                          author={<ActivityAuthor>{authorName}</ActivityAuthor>}
                          item={item}
                          orgSlug={this.props.params.orgId}
                          projectId={group.project.id}
                        />
                      }
                    />
                  </ErrorBoundary>
                );
              }
            })}
          </div>
        </div>
      </div>
    );
  }
}

export {GroupActivity};
export default withApi(withOrganization(GroupActivity));
