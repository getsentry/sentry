/*** @jsx React.DOM */

var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");
var RawStacktraceContent = require("./rawStacktraceContent");
var StacktraceContent = require("./stacktraceContent");

var StacktraceInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired
  },

  getInitialState() {
    return {
      raw: false
    };
  },

  toggleRaw() {
    this.setState({
      raw: !this.state.raw
    });
  },

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;

    var title = (
      <span>
        Stacktrace
        <label className="pull-right">
          <input type="checkbox" onChange={this.toggleRaw} checked={this.state.raw} />
        </label>
      </span>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}>
        {this.state.raw ?
          <RawStacktraceContent data={data} />
        :
          <StacktraceContent data={data} />
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = StacktraceInterface;
