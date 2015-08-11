import React from "react";
import Sticky from "react-sticky";
import DateTime from "../../components/dateTime";
import GroupEventEntries from "../../components/eventEntries";
import GroupEventHeader from "./eventHeader";
import GroupEventTags from "./eventTags";
import GroupState from "../../mixins/groupState";
import Gravatar from "../../components/gravatar";
import PropTypes from "../../proptypes";
import TimeSince from "../../components/timeSince";
import utils from "../../utils";

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
          {user.email && [
            <dt>Email:</dt>,
            <dd>{user.email}</dd>
          ]}
          {user.id && [
            <dt>ID:</dt>,
            <dd>{user.id}</dd>
          ]}
          {user.username && [
            <dt>Username:</dt>,
            <dd>{user.username}</dd>
          ]}
          {user.ipAddress && [
            <dt>IP:</dt>,
            <dd>{user.ipAddress}</dd>
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
          <GroupEventTags
              group={group}
              event={evt} />
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
            </dl>
            {evt.user &&
              <UserWidget data={evt.user} />
            }
          </div>
        </div>
      </div>
    );
  }
});

export default GroupEvent;
