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
    // TODO(dcramer): implement local vars
    return (
      <li className={className}>
        <p>{title}</p>
        {context}
      </li>
    );
  }
});

var StacktraceContent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  render() {
    var data = this.props.data;
    var frames = [];
    var firstFrameOmitted, lastFrameOmitted;

    if (data.frames_omitted) {
      firstFrameOmitted = data.frames_omitted[0];
      lastFrameOmitted = data.frames_omitted[1];
    } else {
      firstFrameOmitted = null;
      lastFrameOmitted = null;
    }

    data.frames.forEach((frame, frameIdx) => {
      frames.push(<Frame key={frameIdx} data={frame} />);
      if (frameIdx === firstFrameOmitted) {
        frames.push((
          <li className="frames-omitted" key="omitted">
            Frames {firstFrameOmitted} until {lastFrameOmitted} were omitted and not available.
          </li>
        ));
      }

    });

    return (
      <div className="traceback">
        <ul>
          {frames}
        </ul>
      </div>
    );
  }
});

module.exports = StacktraceContent;
