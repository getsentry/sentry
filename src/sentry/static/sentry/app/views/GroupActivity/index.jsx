import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {
  addErrorMessage,
  addLoadingMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {t, tct, tn} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Avatar from 'app/components/avatar';
import CommitLink from 'app/components/commitLink';
import ConfigStore from 'app/stores/configStore';
import Duration from 'app/components/duration';
import ErrorBoundary from 'app/components/errorBoundary';
import GroupState from 'app/mixins/groupState';
import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import NoteContainer from 'app/components/activity/noteContainer';
import NoteInput from 'app/components/activity/noteInput';
import PullRequestLink from 'app/views/releases/pullRequestLink';
import TeamStore from 'app/stores/teamStore';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';

class GroupActivityItem extends React.Component {
  static propTypes = {
    author: PropTypes.node,
    item: PropTypes.object,
  };

  render() {
    let {author, item, params} = this.props;
    let {data} = item;
    let {orgId, projectId} = params;

    switch (item.type) {
      case 'note':
        return t('%s left a comment', author);
      case 'set_resolved':
        return t('%s marked this issue as resolved', author);
      case 'set_resolved_by_age':
        return t('%(author)s marked this issue as resolved due to inactivity', {
          author,
        });
      case 'set_resolved_in_release':
        return data.version
          ? t('%(author)s marked this issue as resolved in %(version)s', {
              author,
              version: (
                <Version version={data.version} orgId={orgId} projectId={projectId} />
              ),
            })
          : t('%s marked this issue as resolved in the upcoming release', author);
      case 'set_resolved_in_commit':
        return t('%(author)s marked this issue as fixed in %(version)s', {
          author,
          version: (
            <CommitLink
              inline={true}
              commitId={data.commit && data.commit.id}
              repository={data.commit && data.commit.repository}
            />
          ),
        });
      case 'set_resolved_in_pull_request':
        return t('%(author)s marked this issue as fixed in %(version)s', {
          author,
          version: (
            <PullRequestLink
              inline={true}
              pullRequest={data.pullRequest}
              repository={data.pullRequest && data.pullRequest.repository}
            />
          ),
        });
      case 'set_unresolved':
        return t('%s marked this issue as unresolved', author);
      case 'set_ignored':
        if (data.ignoreDuration) {
          return t('%(author)s ignored this issue for %(duration)s', {
            author,
            duration: <Duration seconds={data.ignoreDuration * 60} />,
          });
        } else if (data.ignoreCount && data.ignoreWindow) {
          return tct(
            '[author] ignored this issue until it happens [count] time(s) in [duration]',
            {
              author,
              count: data.ignoreCount,
              duration: <Duration seconds={data.ignoreWindow * 60} />,
            }
          );
        } else if (data.ignoreCount) {
          return tct('[author] ignored this issue until it happens [count] time(s)', {
            author,
            count: data.ignoreCount,
          });
        } else if (data.ignoreUserCount && data.ignoreUserWindow) {
          return tct(
            '[author] ignored this issue until it affects [count] user(s) in [duration]',
            {
              author,
              count: data.ignoreUserCount,
              duration: <Duration seconds={data.ignoreUserWindow * 60} />,
            }
          );
        } else if (data.ignoreUserCount) {
          return tct('[author] ignored this issue until it affects [count] user(s)', {
            author,
            count: data.ignoreUserCount,
          });
        }
        return t('%s ignored this issue', author);
      case 'set_public':
        return t('%s made this issue public', author);
      case 'set_private':
        return t('%s made this issue private', author);
      case 'set_regression':
        return data.version
          ? t('%(author)s marked this issue as a regression in %(version)s', {
              author,
              version: (
                <Version version={data.version} orgId={orgId} projectId={projectId} />
              ),
            })
          : t('%s marked this issue as a regression', author);
      case 'create_issue':
        return t('%(author)s created an issue on %(provider)s titled %(title)s', {
          author,
          provider: data.provider,
          title: <a href={data.location}>{data.title}</a>,
        });
      case 'unmerge_source':
        return tn(
          '%2$s migrated %1$d fingerprint to %3$s',
          '%2$s migrated %1$d fingerprints to %3$s',
          data.fingerprints.length,
          author,
          data.destination ? (
            <a href={`/${orgId}/${projectId}/issues/${data.destination.id}`}>
              {data.destination.shortId}
            </a>
          ) : (
            t('a group')
          )
        );
      case 'unmerge_destination':
        return tn(
          '%2$s migrated %1$d fingerprint from %3$s',
          '%2$s migrated %1$d fingerprints from %3$s',
          data.fingerprints.length,
          author,
          data.source ? (
            <a href={`/${orgId}/${projectId}/issues/${data.source.id}`}>
              {data.source.shortId}
            </a>
          ) : (
            t('a group')
          )
        );
      case 'first_seen':
        return t('%s first saw this issue', author);
      case 'assigned':
        if (data.assigneeType == 'team') {
          return t('%(author)s assigned this issue to #%(assignee)s', {
            author,
            assignee: TeamStore.getById(data.assignee).slug,
          });
        }
        let assignee;
        if (item.user && data.assignee === item.user.id) {
          assignee = 'themselves';
          return t('%s assigned this issue to themselves', author);
        } else {
          assignee = MemberListStore.getById(data.assignee);
          if (assignee && assignee.email) {
            return t('%(author)s assigned this issue to %(assignee)s', {
              author,
              assignee: assignee.email,
            });
          } else {
            return t('%s assigned this issue to an unknown user', author);
          }
        }
      case 'unassigned':
        return t('%s unassigned this issue', author);
      case 'merge':
        return tn(
          '%2$s merged %1$d issue into this issue',
          '%2$s merged %1$d issues into this issue',
          data.issues.length,
          author
        );
      default:
        return ''; // should never hit (?)
    }
  }
}

const GroupActivity = createReactClass({
  displayName: 'GroupActivity',

  // TODO(dcramer): only re-render on group/activity change
  propTypes: {
    group: PropTypes.object,
  },

  mixins: [GroupState, ApiMixin],

  onNoteDelete(item) {
    let {group} = this.props;

    // Optimistically remove from UI
    let index = GroupStore.removeActivity(group.id, item.id);
    if (index === -1) {
      // I dunno, the id wasn't found in the GroupStore
      return;
    }

    addLoadingMessage(t('Removing comment...'));

    this.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
      method: 'DELETE',
      success: () => {
        removeIndicator();
      },
      error: error => {
        GroupStore.addActivity(group.id, item, index);
        removeIndicator();
        addErrorMessage(t('Failed to delete comment'));
      },
    });
  },

  render() {
    let group = this.props.group;
    let me = ConfigStore.get('user');
    let memberList = MemberListStore.getAll();

    let children = group.activity.map((item, itemIdx) => {
      let authorName = item.user ? item.user.name : 'Sentry';

      if (item.type === 'note') {
        return (
          <NoteContainer
            group={group}
            item={item}
            key={'note' + itemIdx}
            author={{
              name: authorName,
              avatar: <Avatar user={item.user} size={38} />,
            }}
            onDelete={this.onNoteDelete}
            sessionUser={me}
            memberList={memberList}
          />
        );
      } else {
        let avatar = item.user ? (
          <Avatar user={item.user} size={18} className="activity-avatar" />
        ) : (
          <div className="activity-avatar avatar sentry">
            <span className="icon-sentry-logo" />
          </div>
        );

        let author = {
          name: authorName,
          avatar,
        };

        return (
          <li className="activity-item" key={item.id}>
            <a name={'event_' + item.id} />
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-content">
              <ErrorBoundary mini>
                <GroupActivityItem
                  author={
                    <span key="author">
                      {avatar}
                      <span className="activity-author">{author.name}</span>
                    </span>
                  }
                  item={item}
                  params={this.props.params}
                />
              </ErrorBoundary>
            </div>
          </li>
        );
      }
    });

    return (
      <div className="row">
        <div className="col-md-9">
          <div className="activity-container">
            <ul className="activity">
              <li className="activity-note" key="activity-note">
                <Avatar user={me} size={38} />
                <div className="activity-bubble">
                  <NoteInput group={group} memberList={memberList} sessionUser={me} />
                </div>
              </li>
              {children}
            </ul>
          </div>
        </div>
      </div>
    );
  },
});

export default GroupActivity;
