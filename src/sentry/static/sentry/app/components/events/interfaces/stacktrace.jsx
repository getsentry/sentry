import React from "react";
import ConfigStore from "../../../stores/configStore";
import GroupEventDataSection from "../eventDataSection";
import PropTypes from "../../../proptypes";
import rawStacktraceContent from "./rawStacktraceContent";
import StacktraceContent from "./stacktraceContent";

var StacktraceInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired
  },

  getInitialState() {
    var user = ConfigStore.get("user");
    // user may not be authenticated
    var options = user ? user.options : {};
    var platform = this.props.event.platform;
    var newestFirst;
    switch (options.stacktraceOrder) {
      case "newestFirst":
        newestFirst = true;
        break;
      case "newestLast":
        newestFirst = false;
        break;
      case "default":
        newestFirst = (platform === "python");
    }

    return {
      stackView: (this.props.data.hasSystemFrames ? "app" : "full"),
      newestFirst: newestFirst
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
    var newestFirst = this.state.newestFirst;

    var title = (
      <div>
        <div className="btn-group">
          {data.hasSystemFrames &&
            <a className={(stackView === "app" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "app")}>App Only</a>
          }
          <a className={(stackView === "full" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "full")}>Full</a>
          <a className={(stackView === "raw" ? "active" : "") + " btn btn-default btn-sm"} onClick={this.toggleStack.bind(this, "raw")}>Raw</a>
        </div>
        <h3>
          {'Stacktrace '}
          {newestFirst ?
            <small>(most recent call last)</small>
          :
            <small>(most recent call first)</small>
          }
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        {stackView === "raw" ?
          <pre className="traceback plain">
            {rawStacktraceContent(data, this.props.platform)}
          </pre>
        :
          <StacktraceContent
              data={data}
              includeSystemFrames={stackView === "full"}
              platform={evt.platform}
              newestFirst={newestFirst} />
        }
      </GroupEventDataSection>
    );
  }
});

export default StacktraceInterface;
