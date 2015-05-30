/*** @jsx React.DOM */

var React = require("react");
var Sticky = require("react-sticky");

var GroupEventDataSection = require("./eventDataSection");
var PropTypes = require("../../proptypes");
var utils = require("../../utils");

var GroupEventExtraData = React.createClass({
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

var GroupEventEntries = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  // TODO(dcramer): make this extensible
  interfaces: {
    exception: require("./interfaces/exception"),
    request: require("./interfaces/request"),
    stacktrace: require("./interfaces/stacktrace")
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render(){
    var group = this.props.group;
    var evt = this.props.event;

    var entries = evt.entries.map((entry, entryIdx) => {
      try {
        var Component = this.interfaces[entry.type];
        if (!Component) {
          console.error('Unregistered interface: ' + entry.type);
          return;
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
      <div>
        {entries}
        {!utils.objectIsEmpty(evt.context) &&
          <GroupEventExtraData
              group={group}
              event={evt} />
        }
      </div>
    );
  }
});

module.exports = GroupEventEntries;
