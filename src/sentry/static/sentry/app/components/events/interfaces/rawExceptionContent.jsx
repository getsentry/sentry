import React from "react";
import rawStacktraceContent from "./rawStacktraceContent";

var RawExceptionContent = React.createClass({
  propTypes: {
    platform: React.PropTypes.string
  },

  render() {
    var children = this.props.values.map((exc, excIdx) => {
      return (
        <pre key={excIdx} className="traceback plain">
          {rawStacktraceContent(exc.stacktrace, this.props.platform, exc)}
        </pre>
      );
    });

    return (
      <div>
        {children}
      </div>
    );
  }
});

export default RawExceptionContent;