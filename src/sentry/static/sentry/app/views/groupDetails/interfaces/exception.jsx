/*** @jsx React.DOM */

var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");
var StacktraceContent = require("./stacktraceContent");

var ExceptionInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;

    // TODO(dcramer): implement exceptions omitted
    var children = data.values.map((exc, excIdx) => {
      return (
        <div key={excIdx}>
          <h3>
            <span>{exc.type}</span>
          </h3>
          {exc.value &&
            <pre className="exc-message">{exc.value}</pre>
          }
          <StacktraceContent data={exc.stacktrace} />
        </div>
      );
    });

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title="Exception">
        {children}
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
