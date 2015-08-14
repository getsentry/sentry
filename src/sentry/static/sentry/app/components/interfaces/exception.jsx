import React from "react";
import ConfigStore from "../../stores/configStore";
import GroupEventDataSection from "../eventDataSection";
import PropTypes from "../../proptypes";
import RawStacktraceContent from "./rawStacktraceContent";
import StacktraceContent from "./stacktraceContent";
import {defined} from "../../utils";

var ExceptionContent = React.createClass({
  propTypes: {
    view: React.PropTypes.string.isRequired,
    platform: React.PropTypes.string,
    newestFirst: React.PropTypes.bool
  },

  render() {
    var stackView = this.props.view;
    var children = this.props.values.map((exc, excIdx) => {
      return (
        <div key={excIdx}>
          <h4>
            <span>{exc.type}</span>
          </h4>
          {exc.value &&
            <pre className="exc-message">{exc.value}</pre>
          }
          {defined(exc.stacktrace) && (stackView === "raw" ?
            <RawStacktraceContent
                data={exc.stacktrace}
                platform={this.props.platform}
                newestFirst={this.props.newestFirst} />
          :
            <StacktraceContent
                data={exc.stacktrace}
                includeSystemFrames={stackView === "full"}
                platform={this.props.platform}
                newestFirst={this.props.newestFirst} />
          )}
        </div>
      );
    });
    if (this.props.newestFirst) {
      children.reverse();
    }

    // TODO(dcramer): implement exceptions omitted
    return (
      <div>
        {children}
      </div>
    );
  }
});

var ExceptionInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  getInitialState() {
    var user = ConfigStore.get("user");
    var platform = this.props.event.platform;
    var newestFirst;
    switch (user.options.stacktraceOrder) {
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
        {'Exception '}
        {newestFirst ?
          <small>(most recent call first)</small>
        :
          <small>(most recent call last)</small>
        }
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
            platform={evt.platform}
            newestFirst={newestFirst} />
      </GroupEventDataSection>
    );
  }
});

export default ExceptionInterface;

