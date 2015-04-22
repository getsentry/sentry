/*** @jsx React.DOM */

var React = require("react");

var GroupEventDataSection = require("./eventDataSection");
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

var GroupEventExtraData = React.createClass({
  mixins: [GroupState],

  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render() {
    var children = [];
    var context = this.props.event.context;
    for (var key in context) {
      children.push(<dt key={'dt-' + key}>{key}</dt>);
      children.push((
        <dd key={'dd-' + key}>
          <pre>{JSON.stringify(context[key], null, 2)}</pre>
        </dd>
      ));
    }

    return (
      <GroupEventDataSection
          group={this.props.group}
          event={this.props.event}
          type="extra"
          title="Additional Data">
        <dl className="vars">
          {children}
        </dl>
      </GroupEventDataSection>
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
      <div className="row event">
        <div className="col-md-9">
          <GroupEventHeader
              group={group}
              event={evt} />
          <GroupEventTags
              group={group}
              event={evt} />
          {entries}
          {!utils.objectIsEmpty(evt.context) &&
            <GroupEventExtraData
                group={group}
                event={evt} />
          }
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
