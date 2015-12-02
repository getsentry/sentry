import React from 'react';

import Duration from '../../components/duration';
import Gravatar from '../../components/gravatar';
import GroupState from '../../mixins/groupState';
import MemberListStore from '../../stores/memberListStore';
import TimeSince from '../../components/timeSince';
import ConfigStore from '../../stores/configStore';
import Version from '../../components/version';

import NoteContainer from './noteContainer';
import NoteInput from './noteInput';
import {t} from '../../locale';


const GroupActivity = React.createClass({
  // TODO(dcramer): only re-render on group/activity change

  mixins: [GroupState],

  formatActivity(author, item, params) {
    let data = item.data;
    let {orgId, projectId} = params;

    switch(item.type) {
      case 'note':
        return t('%s left a comment', author);
      case 'set_resolved':
        return t('%s marked this issue as resolved', author);
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
      case 'set_muted':
        if (data.snoozeDuration) {
          return t('%(author)s snoozed this issue for %(duration)s', {
            author: author,
            duration: <Duration seconds={data.snoozeDuration * 60} />
          });
        }
        return t('%s muted this issue', author);
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
        return t('created an issue on %(provider)s titled %(title)s', {
          provider: data.provider,
          title: <a href={data.location}>{data.title}</a>
        });
      case 'first_seen':
        return t('%s first saw this issue', author);
      case 'assigned':
        let assignee;
        if (data.assignee === item.user.id) {
          assignee = 'themselves';
          return t('%s assigned this event to themselves', author);
        } else {
          assignee = MemberListStore.getById(data.assignee);
          if (assignee.email) {
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
      default:
        return ''; // should never hit (?)
    }
  },

  render() {
    let group = this.props.group;
    let me = ConfigStore.get('user');

    let children = group.activity.map((item, itemIdx) => {
      let avatar = (item.user ?
        <Gravatar email={item.user.email} size={64} className="avatar" /> :
        <div className="avatar sentry"><span className="icon-sentry-logo"></span></div>);

      let author = {
        name: item.user ? item.user.name : 'Sentry',
        avatar: avatar,
      };

      if (item.type === 'note') {
        return (
          <NoteContainer group={group} item={item} key={itemIdx} author={author} />
        );
      } else {
        return (
          <li className="activity-item" key={itemIdx}>
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-content">
              {this.formatActivity(
                <span>
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
              <li className="activity-note">
                <Gravatar email={me.email} size={64} className="avatar" />
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
