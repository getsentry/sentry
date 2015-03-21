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

  // TODO(dcramer): make this extensible
  interfaces: {
    exception: require("./interfaces/exception"),
    request: require("./interfaces/request"),
    stacktrace: require("./interfaces/stacktrace")
  },

  render(){
    var group = this.getGroup();
    var evt = this.props.event;

    var entries = evt.entries.map((entry, entryIdx) => {
      try {
        var Component = this.interfaces[entry.type];
        if (!Component) {
          throw new Error('Unregistered interface: ' + entry.type);

        }
        return <Component
                  key={"entry-" + entryIdx}
                  group={group}
                  event={evt}
                  type={entry.type}
                  data={entry.data} />;
      } catch (ex) {
        // TODO(dcramer): this should log to Sentry
        return (
          <GroupEventDataSection
              group={group}
              event={evt}
              type={entry.type}
              title={entry.type}>
            <p>There was an error rendering this data.</p>
          </GroupEventDataSection>
        );
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
          {evt.user &&
            <UserWidget data={evt.user} />
          }

          <h6>Sample ID</h6>
          <p><strong className="truncate">{evt.eventID}</strong></p>

          <h6>Time</h6>
          <p><strong>{evt.dateCreated}</strong></p>
        </div>
      </div>
    );
  }
});

module.exports = GroupEvent;
