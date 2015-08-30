import React from "react";
import DateTime from "../../components/dateTime";
import FileSize from "../../components/fileSize";
import GroupEventEntries from "../../components/events/eventEntries";
import GroupState from "../../mixins/groupState";
import Gravatar from "../../components/gravatar";
import PropTypes from "../../proptypes";
import TimeSince from "../../components/timeSince";
import Version from "../../components/version";


var UserWidget = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var user = this.props.data;

    return (
      <div className="user-widget">
        <div className="pull-right"><Gravatar email={user.email} size={84} /></div>
        <h6><span>User</span></h6>
        <dl>
          {user.id && [
            <dt key="id-label">ID:</dt>,
            <dd key="id">{user.id}</dd>
          ]}
          {user.email && [
            <dt key="email-label">Email:</dt>,
            <dd key="email">{user.email}</dd>
          ]}
          {user.username && [
            <dt key="username-label">Username:</dt>,
            <dd key="username">{user.username}</dd>
          ]}
          {user.ipAddress && [
            <dt key="ipAddress-label">IP:</dt>,
            <dd key="ipAddress">{user.ipAddress}</dd>
          ]}
        </dl>
        <div className="btn-group hidden">
          <a href="#" className="btn btn-xs btn-default">Message User</a>
          <a href="#" className="btn btn-xs btn-default">Message All</a>
        </div>
      </div>
    );
  }
});

var ReleaseWidget = React.createClass({
  render() {
    var release = this.props.data;

    return (
      <div className="user-widget">
        <h6><span>Release</span></h6>
        <dl>
          <dt key={4}>Version:</dt>
          <dd key={5}><Version version={release.version} /></dd>
        </dl>
      </div>
    );
  }
});

var GroupEvent = React.createClass({
  mixins: [GroupState],

  propTypes: {
    event: PropTypes.Event.isRequired
  },

  render(){
    var group = this.getGroup();
    var evt = this.props.event;

    return (
      <div className="row event">
        <div className="col-md-9">
          <GroupEventEntries
              group={group}
              event={evt} />
        </div>
        <div className="col-md-3">
          <div className="event-stats group-stats">
            <h6><span>Meta</span></h6>
            <dl>
              <dt>ID:</dt>
              <dd className="truncate">{evt.eventID}</dd>
              <dt>When:</dt>
              <dd><TimeSince date={evt.dateCreated} /></dd>
              <dt>Date:</dt>
              <dd><DateTime date={evt.dateCreated} /></dd>
              <dt>Size:</dt>
              <dd><FileSize bytes={evt.size} /></dd>
            </dl>
            {evt.user &&
              <UserWidget data={evt.user} />
            }
            {evt.release &&
              <ReleaseWidget data={evt.release} />
            }
          </div>
        </div>
      </div>
    );
  }
});

export default GroupEvent;
