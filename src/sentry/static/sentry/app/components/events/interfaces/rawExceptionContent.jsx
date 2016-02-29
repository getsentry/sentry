import React from 'react';
import rawStacktraceContent from './rawStacktraceContent';

const RawExceptionContent = React.createClass({
  propTypes: {
    platform: React.PropTypes.string,
    values: React.PropTypes.array.isRequired,
  },

  render() {
    let children = this.props.values.map((exc, excIdx) => {
      return (
        <pre key={excIdx} className="traceback plain">
          {exc.stacktrace && rawStacktraceContent(exc.stacktrace, this.props.platform, exc)}
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
