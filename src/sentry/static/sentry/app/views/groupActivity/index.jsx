import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';

import Duration from '../../components/duration';
import Avatar from '../../components/avatar';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import NoteContainer from '../../components/activity/noteContainer';
import NoteInput from '../../components/activity/noteInput';

import ConfigStore from '../../stores/configStore';
import GroupStore from '../../stores/groupStore';
import IndicatorStore from '../../stores/indicatorStore';
import MemberListStore from '../../stores/memberListStore';

import {t, tn} from '../../locale';

const GroupActivity = React.createClass({
  // TODO(dcramer): only re-render on group/activity change
  propTypes: {
    group: React.PropTypes.object
  },

  mixins: [
    GroupState,
    ApiMixin
  ],

  formatActivity(author, item, params) {
    let data = item.data;
    let {orgId, projectId} = params;

    switch(item.type) {
      case 'note':
        return t('%s left a comment', author);
      case 'set_resolved':
        return t('%s marked this issue as resolved', author);
      case 'set_resolved_by_age':
        return t('%(author)s marked this issue as resolved due to inactivity', {
          author: author,
        });
      case 'set_resolved_in_release':
        return (data.version ?
          t('%(author)s marked this issue as resolved in %(version)s', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={projectId} />
          })
        :
          t('%s marked this issue as resolved in the upcoming release', author)
        );
      case 'set_unresolved':
        return t('%s marked this issue as unresolved', author);
      case 'set_ignored':
        if (data.ignoreDuration) {
          return t('%(author)s ignored this issue for %(duration)s', {
            author: author,
            duration: <Duration seconds={data.ignoreDuration * 60} />
          });
        }
        return t('%s ignored this issue', author);
      case 'set_public':
        return t('%s made this issue public', author);
      case 'set_private':
        return t('%s made this issue private', author);
      case 'set_regression':
        return (data.version ?
          t('%(author)s marked this issue as a regression in %(version)s', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={projectId} />
          })
        :
          t('%s marked this issue as a regression', author)
        );
      case 'create_issue':
        return t('%(author)s created an issue on %(provider)s titled %(title)s', {
          author: author,
          provider: data.provider,
          title: <a href={data.location}>{data.title}</a>
        });
      case 'first_seen':
        return t('%s first saw this issue', author);
      case 'assigned':
        let assignee;
        if (item.user && data.assignee === item.user.id) {
          assignee = 'themselves';
          return t('%s assigned this event to themselves', author);
        } else {
          assignee = MemberListStore.getById(data.assignee);
          if (assignee && assignee.email) {
            return t('%(author)s assigned this event to %(assignee)s', {
              author: author,
              assignee: assignee.email
            });
          } else {
            return t('%s assigned this event to an unknown user', author);
          }
        }
        return t('%(author)s assigned this event to %(assignee)s', {
          author: author,
          assignee: assignee.email
        });
      case 'unassigned':
        return t('%s unassigned this issue', author);
      case 'merge':
        return tn('%2$s merged %1$d issue into this issue',
                  '%2$s merged %1$d issues into this issue',
                  data.issues.length,
                  author);
      default:
        return ''; // should never hit (?)
    }
  },

  onNoteDelete(item) {
    let {group} = this.props;

    // Optimistically remove from UI
    let index = GroupStore.removeActivity(group.id, item.id);
    if (index === -1) {
      // I dunno, the id wasn't found in the GroupStore
      return;
    }

    let loadingIndicator = IndicatorStore.add(t('Removing comment..'));

    this.api.request('/issues/' + group.id + '/comments/' + item.id + '/' , {
      method: 'DELETE',
      error: (error) => {
        // TODO(mattrobenolt): Show an actual error that this failed,
        // but just bring it back in place for now
        GroupStore.addActivity(group.id, item, index);
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let group = this.props.group;
    let me = ConfigStore.get('user');

    let children = group.activity.map((item, itemIdx) => {
      let avatar = (item.user ?
        <Avatar user={item.user} size={64} className="avatar" /> :
        <div className="avatar sentry"><span className="icon-sentry-logo"></span></div>);

      let author = {
        name: item.user ? item.user.name : 'Sentry',
        avatar: avatar,
      };

      if (item.type === 'note') {
        return (
          <NoteContainer group={group} item={item} key={itemIdx} author={author} onDelete={this.onNoteDelete} />
        );
      } else {
        return (
          <li className="activity-item" key={item.id}>
            <a name={'event_' + item.id} />
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-content">
              {this.formatActivity(
                <span key="author">
                  {author.avatar}
                  <span className="activity-author">{author.name}</span>
                </span>,
                item,
                this.props.params
              )}
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
                <Avatar user={me} size={64} className="avatar" />
                <div className="activity-bubble">
                  <NoteInput group={group} />
                </div>
              </li>
              {children}
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

export default GroupActivity;
