import React from "react";
import Gravatar from "../../components/gravatar";
import GroupState from "../../mixins/groupState";
import MemberListStore from "../../stores/memberListStore";
import TimeSince from "../../components/timeSince";
import ConfigStore from "../../stores/configStore";

import NoteContainer from "./noteContainer";
import NoteInput from "./noteInput";

var formatActivity = function(item) {
  var data = item.data;

  switch(item.type) {
    case "note":
      return "left a comment";
    case "set_resolved":
      return "marked this event as resolved";
    case "set_unresolved":
      return "marked this event as unresolved";
    case "set_muted":
      return "marked this event as muted";
    case "set_public":
      return "made this event public";
    case "set_private":
      return "made this event private";
    case "set_regression":
      return "marked this event as a regression";
    case "create_issue":
      return <span>created an issue on {data.provider} titled <a href={data.location}>{data.title}</a></span>;
    case "first_seen":
      return "first saw this event";
    case "assigned":
      var assignee;
      if (data.assignee === item.user.id) {
        assignee = 'themselves';
      } else {
        assignee = MemberListStore.getById(data.assignee);
        assignee = (assignee ? assignee.email : 'an unknown user');
      }
      return `assigned this event to ${assignee}`;
    case "unassigned":
      return "unassigned this event";
    default:
      return ""; // should never hit (?)
  }
};

var GroupActivity = React.createClass({
  // TODO(dcramer): only re-render on group/activity change

  mixins: [GroupState],

  render() {
    var group = this.props.group;
    var me = ConfigStore.get('user');

    var children = group.activity.map((item, itemIdx) => {
      var avatar = (item.user ?
        <Gravatar email={item.user.email} size={64} className="avatar" /> :
        <div className="avatar sentry"><span className="icon-sentry-logo"></span></div>);

      var author = {
        name: item.user ? item.user.name : 'Sentry',
        avatar: avatar,
      };

      var label = formatActivity(item);

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
