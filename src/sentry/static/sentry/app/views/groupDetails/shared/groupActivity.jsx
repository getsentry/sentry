import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import {
  addErrorMessage,
  addLoadingMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import ActivityAuthor from 'app/components/activity/author';
import ActivityItem from 'app/components/activity/item';
import Avatar from 'app/components/avatar';
import ConfigStore from 'app/stores/configStore';
import ErrorBoundary from 'app/components/errorBoundary';
import GroupActivityItem from 'app/views/groupDetails/shared/groupActivityItem';
import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import Note from 'app/components/activity/note';
import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

class GroupActivity extends React.Component {
  // TODO(dcramer): only re-render on group/activity change
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    group: SentryTypes.Group,
  };

  getMemberList = (memberList, sessionUser) =>
    _.uniqBy(memberList, ({id}) => id).filter(({id}) => sessionUser.id !== id);

  handleNoteDelete = item => {
    const {group} = this.props;

    addLoadingMessage(t('Removing comment...'));

    // Optimistically remove from UI
    // removeGroupActivity(group, item);
    const index = GroupStore.removeActivity(group.id, item.id);
    if (index === -1) {
      // I dunno, the id wasn't found in the GroupStore
      return;
    }

    this.props.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
      method: 'DELETE',
      success: () => {
        removeIndicator();
      },
      error: () => {
        GroupStore.addActivity(group.id, item, index);
        removeIndicator();
        addErrorMessage(t('Failed to delete comment'));
      },
    });
  };

  handleNoteCreate = note => {
    const {group} = this.props;

    addLoadingMessage(t('Posting comment...'));

    this.props.api.request('/issues/' + group.id + '/comments/', {
      method: 'POST',
      data: note,
      error: error => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson(),
        });
        removeIndicator();
      },
      success: data => {
        this.setState({
          value: '',
          preview: false,
          expanded: false,
          loading: false,
          mentions: [],
        });
        GroupStore.addActivity(group.id, data);
        this.finish();
        removeIndicator();
      },
    });
  };

  handleNoteUpdate = (note, item) => {
    const {group} = this.props;

    addLoadingMessage(t('Updating comment...'));
    this.props.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
      method: 'PUT',
      data: note,
      error: error => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson(),
        });
        removeIndicator();
      },
      success: data => {
        this.setState({
          preview: false,
          expanded: false,
          loading: false,
        });
        GroupStore.updateActivity(group.id, item.id, {text: this.state.value});
        removeIndicator();
        this.finish();
      },
    });
  };

  getMentionableTeams = projectSlug => {
    return (
      ProjectsStore.getBySlug(projectSlug) || {
        teams: [],
      }
    ).teams;
  };

  render() {
    const {organization, group} = this.props;
    const me = ConfigStore.get('user');
    const memberList = this.getMemberList(MemberListStore.getAll(), me);
    const teams = this.getMentionableTeams(group && group.project && group.project.slug);
    const noteProps = {
      group,
      memberList,
      teams,
    };

    return (
      <div className="row">
        <div className="col-md-9">
          <div>
            <ActivityItem author={{type: 'user', user: me}}>
              {() => (
                <NoteInputWithStorage
                  storageKey="groupinput:latest"
                  itemKey={group.id}
                  onCreate={this.handleNoteCreate}
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
                      item={item}
                      id={`note-${item.id}`}
                      author={{
                        name: authorName,
                        avatar: <Avatar user={item.user} size={38} />,
                      }}
                      onDelete={this.handleNoteDelete}
                      onUpdate={this.handleNoteUpdate}
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
                          organization={organization}
                          author={<ActivityAuthor>{authorName}</ActivityAuthor>}
                          item={item}
                          orgId={this.props.params.orgId}
                          projectId={group.project.slug}
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
