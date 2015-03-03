/*** @jsx React.DOM */

var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");
var StacktraceContent = require("./stacktraceContent");

var StacktraceInterface = React.createClass({
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

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title="Stacktrace">
        <StacktraceContent data={data} />
      </GroupEventDataSection>
    );
  }
});

module.exports = StacktraceInterface;
