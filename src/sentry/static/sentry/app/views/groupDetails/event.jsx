/*** @jsx React.DOM */

var React = require("react");

var GroupEventDataSection = require("./eventDataSection");
var GroupEventHeader = require("./eventHeader");
var GroupEventTags = require("./eventTags");
var GroupState = require("../../mixins/groupState");
var Gravatar = require("../../components/gravatar");
var PropTypes = require("../../proptypes");

var UserWidget = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    var user = this.props.data;

    return (
      <div>
        <h6>User</h6>
        <p><strong>{user.email}</strong></p>
        <Gravatar email={user.email} />
      </div>
    );
  }
});

var GroupEvent = React.createClass({
  mixins: [GroupState],

  propTypes: {
    event: PropTypes.Event.isRequired
  },

  // TODO(dcramer): figure out how we make this extensible
  interfaces: {
    exception: require("./interfaces/exception"),
    request: require("./interfaces/request")
  },

  render(){
    var group = this.getGroup();
    var evt = this.props.event;

    var entries = [];
    evt.entries.forEach((entry, entryIdx) => {
      try {
        var Component = this.interfaces[entry.type];
        if (!Component) {
          throw new Error('Unregistered interface: ' + entry.type);

        }
        entries.push(
          <Component
              key={"entry-" + entryIdx}
              group={group}
              event={evt}
              data={entry.data} />
        );
      } catch (ex) {
        // TODO(dcramer): this should log to Sentry
        console.error(ex);
      }
    });

    return (
      <div className="row">
        <div className="col-md-9">
          <GroupEventHeader
              group={group}
              event={evt} />
          <GroupEventTags
              group={group}
              event={evt} />
          {entries}
          <GroupEventDataSection
              group={group}
              event={evt}
              type="extra"
              title="Additional Data" />
        </div>
        <div className="col-md-3 event-stats">
          <h6>Sample ID</h6>
          <p><strong>{evt.eventID}</strong></p>

          <h6>Time</h6>
          <p><strong>{evt.dateCreated}</strong></p>

          {evt.user &&
            <UserWidget data={evt.user} />
          }
        </div>
      </div>
    );
  }
});

module.exports = GroupEvent;
