var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
var RawStacktraceContent = require("./rawStacktraceContent");
var StacktraceContent = require("./stacktraceContent");

var ExceptionContent = React.createClass({
  propTypes: {
    view: React.PropTypes.string.isRequired
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
                <RawStacktraceContent data={exc.stacktrace} />
              :
                <StacktraceContent
                    data={exc.stacktrace}
                    includeSystemFrames={stackView === "full"} />
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
      stackView: "app"
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
        <ul className="nav nav-tabs">
          <li>Stacktrace:</li>
          <li className={stackView === "app" && "active"}>
            <a onClick={this.toggleStack.bind(this, "app")}>App</a>
          </li>
          <li className={stackView === "full" && "active"}>
            <a onClick={this.toggleStack.bind(this, "full")}>Full</a>
          </li>
          <li className={stackView === "raw" && "active"}>
            <a onClick={this.toggleStack.bind(this, "raw")}>Raw</a>
          </li>
        </ul>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}>
        <ExceptionContent view={stackView} values={data.values} />
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
