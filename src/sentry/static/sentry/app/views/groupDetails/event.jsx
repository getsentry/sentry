var React = require("react");
var Sticky = require("react-sticky");

var GroupEventEntries = require("../../components/eventEntries");
var GroupEventHeader = require("./eventHeader");
var GroupEventTags = require("./eventTags");
var GroupState = require("../../mixins/groupState");
var Gravatar = require("../../components/gravatar");
var PropTypes = require("../../proptypes");
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
        <h6>User</h6>
        <p><strong>{user.email}</strong></p>
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
          <div className="event-stats">
            {evt.user &&
              <UserWidget data={evt.user} />
            }

            <h6>Sample ID</h6>
            <p><strong className="truncate">{evt.eventID}</strong></p>

            <h6>Time</h6>
            <p><strong>{evt.dateCreated}</strong></p>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = GroupEvent;
