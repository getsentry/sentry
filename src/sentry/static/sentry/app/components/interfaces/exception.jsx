var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../proptypes");
var RawStacktraceContent = require("./rawStacktraceContent");
var StacktraceContent = require("./stacktraceContent");

var ExceptionContent = React.createClass({
  render() {
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
              <StacktraceContent data={exc.stacktrace} />
            </div>
          );
        })}
      </div>
    );
  }
});

var RawExceptionContent = React.createClass({
  render() {
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
              <RawStacktraceContent data={exc.stacktrace} />
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
        Exception
        <label className="raw-toggle pull-right">
          <input type="checkbox" onChange={this.toggleRaw} checked={this.state.raw} />
          Raw
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
          <RawExceptionContent values={data.values} />
        :
          <ExceptionContent values={data.values} />
        }
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
