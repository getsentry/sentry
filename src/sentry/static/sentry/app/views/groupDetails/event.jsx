var React = require("react");
var Sticky = require("react-sticky");

var DateTime = require("../../components/dateTime");
var GroupEventEntries = require("../../components/eventEntries");
var GroupEventHeader = require("./eventHeader");
var GroupEventTags = require("./eventTags");
var GroupState = require("../../mixins/groupState");
var Gravatar = require("../../components/gravatar");
var PropTypes = require("../../proptypes");
var TimeSince = require("../../components/timeSince");
var utils = require("../../utils");

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
        <div className="btn-group">
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

module.exports = GroupEvent;
