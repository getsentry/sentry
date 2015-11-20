import React from 'react';

import Duration from '../../components/duration';
import Gravatar from '../../components/gravatar';
import GroupState from '../../mixins/groupState';
import MemberListStore from '../../stores/memberListStore';
import TimeSince from '../../components/timeSince';
import ConfigStore from '../../stores/configStore';

import NoteContainer from './noteContainer';
import NoteInput from './noteInput';

let formatActivity = function(item) {
  let data = item.data;

  switch(item.type) {
    case 'note':
      return 'left a comment';
    case 'set_resolved':
      return 'marked this issue as resolved';
    case 'set_unresolved':
      return 'marked this issue as unresolved';
    case 'set_muted':
      if (data.snoozeDuration) {
        return <span>snoozed this issue for <Duration seconds={data.snoozeDuration * 60} /></span>;
      }
      return 'muted this issue';
    case 'set_public':
      return 'made this issue public';
    case 'set_private':
      return 'made this issue private';
    case 'set_regression':
      return 'marked this issue as a regression';
    case 'create_issue':
      return <span>created an issue on {data.provider} titled <a href={data.location}>{data.title}</a></span>;
    case 'first_seen':
      return 'first saw this issue';
    case 'assigned':
      let assignee;
      if (data.assignee === item.user.id) {
        assignee = 'themselves';
      } else {
        assignee = MemberListStore.getById(data.assignee);
        assignee = (assignee ? assignee.email : 'an unknown user');
      }
      return `assigned this event to ${assignee}`;
    case 'unassigned':
      return 'unassigned this issue';
    default:
      return ''; // should never hit (?)
  }
};

const GroupActivity = React.createClass({
  // TODO(dcramer): only re-render on group/activity change

  mixins: [GroupState],

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

      let label = formatActivity(item);

      if (item.type === 'note') {
        return (
          <NoteContainer group={group} item={item} key={itemIdx} author={author} />
        );
      } else {
        return (
          <li className="activity-item" key={itemIdx}>
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-content">
              {author.avatar} <span className="activity-author">{author.name}</span> {label}
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
