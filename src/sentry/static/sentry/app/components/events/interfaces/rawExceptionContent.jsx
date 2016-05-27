import React from 'react';
import rawStacktraceContent from './rawStacktraceContent';

const RawExceptionContent = React.createClass({
  propTypes: {
    type: React.PropTypes.oneOf(['original', 'minified']),
    platform: React.PropTypes.string,
    values: React.PropTypes.array.isRequired,
  },

  render() {
    let {type} = this.props;
    let children = this.props.values.map((exc, excIdx) => {
      return (
        <pre key={excIdx} className="traceback plain">
          {exc.stacktrace && rawStacktraceContent(type === 'original' ? exc.stacktrace : exc.rawStacktrace, this.props.platform, exc)}
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
