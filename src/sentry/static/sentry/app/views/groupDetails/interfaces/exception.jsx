/*** @jsx React.DOM */

var React = require("react");
var classSet = require("react/lib/cx");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");

var Frame = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  isDefined(item) {
    return typeof item !== "undefined" && item !== null;
  },

  isUrl(filename) {
    if (!filename) {
      return false;
    }
    return filename.indexOf('http:') !== -1 || filename.indexOf('https:') !== -1;
  },

  render() {
    var data = this.props.data;

    var className = classSet({
      "frame": true,
      "system-frame": !data.in_app,
      "frame-errors": data.errors,
    });

    var title = [];

    if (this.isDefined(data.filename || data.module)) {
      title.push(<code>{data.filename || data.module}</code>);
      if (this.isUrl(data.abs_path)) {
        title.push(<a href={data.abs_path} className="icon-share" />);
      }
      if (this.isDefined(data.function)) {
        title.push(<span> in </span>);
      }
    }

    if (this.isDefined(data.function)) {
        title.push(<code>{data.function}</code>);
    }

    if (this.isDefined(data.lineno)) {
      title.push(<span> at line </span>);
      if (this.isDefined(data.colno)) {
        title.push(<code>{data.lineno}:{data.colno}</code>);
      } else {
        title.push(<code>{data.lineno}</code>);
      }
    }

    var context = '';
    if (this.isDefined(data.context)) {
      context = (
        <ol start={data.start_lineno} className="context">
        {this.isDefined(data.errors) &&
          <li className="expandable error"
              key="errors">{data.errors.join(", ")}</li>
        }
        {data.pre_context.map((lineNo, line) => {
          return <li className="expandable" key={lineNo}>{line}</li>;
        })}
        <li className="active expandable" key="active">{data.context_line}</li>
        {data.post_context.map((lineNo, line) => {
          return <li className="expandable" key={lineNo}>{line}</li>;
        })}
        </ol>
      );
    } else if (this.isDefined(data.context_line)) {
      context = (
        <ol start={data.lineno} className="context">
          <li className="active">{data.context_line}</li>
        </ol>
      );
    }
    // TODO(dcramer): implement popover annotations
    return (
      <li className={className}>
        <p>{title}</p>
        {context}
      </li>
    );
  }
});

var ExceptionInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render() {
    var group = this.props.group;
    var evt = this.props.event;
    var data = this.props.data;

    var children = data.values.map((exc, excIdx) => {
      var frames = exc.stacktrace.frames.map((frame, frameIdx) => {
        return <Frame key={frameIdx} data={frame} />;
      });

      return (
        <div className="traceback" key={excIdx}>
          <h3>
            <span>{exc.type}</span>
          </h3>
          {exc.value &&
            <pre>{exc.value}</pre>
          }
          <ul>
            {frames}
          </ul>
        </div>
      );
    });

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type="exception"
          title="Exception">
        {children}
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
