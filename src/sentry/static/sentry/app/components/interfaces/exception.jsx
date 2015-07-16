var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
var RawStacktraceContent = require("./rawStacktraceContent");
var StacktraceContent = require("./stacktraceContent");

var ExceptionContent = React.createClass({
  propTypes: {
    view: React.PropTypes.string.isRequired,
    platform: React.PropTypes.string
  },

  render() {
    var stackView = this.props.view;
    // TODO(dcramer): implement exceptions omitted
    return (
      <div>
        {this.props.values.map((exc, excIdx) => {
          return (
            <div key={excIdx}>
              <h4>
                <span>{exc.type}</span>
              </h4>
              {exc.value &&
                <pre className="exc-message">{exc.value}</pre>
              }
              {stackView === "raw" ?
                <RawStacktraceContent
                    data={exc.stacktrace}
                    platform={this.props.platform} />
              :
                <StacktraceContent
                    data={exc.stacktrace}
                    includeSystemFrames={stackView === "full"}
                    platform={this.props.platform} />
              }
            </div>
          );
        })}
      </div>
    );
  }
});

var ExceptionInterface = React.createClass({
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
        Exception
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
        <ExceptionContent
            view={stackView}
            values={data.values}
            platform={evt.platform} />
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
