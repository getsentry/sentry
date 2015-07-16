var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
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
      stackView: (this.props.data.hasSystemFrames ? "app" : "full")
    };
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;
    var stackView = this.state.stackView;

    var title = (
      <div>
        Stacktrace
        <div className="btn-group">
          {data.hasSystemFrames &&
            <a className={(stackView === "app" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "app")}>App Only</a>
          }
          <a className={(stackView === "full" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "full")}>Full</a>
          <a className={(stackView === "raw" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "raw")}>Raw</a>
        </div>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}>
        {stackView === "raw" ?
          <RawStacktraceContent data={data} />
        :
          <StacktraceContent
              data={data}
              includeSystemFrames={stackView === "full"} />
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = StacktraceInterface;
