import React from 'react';
import PropTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import ExceptionContent from './exceptionContent';
import RawExceptionContent from './rawExceptionContent';


const CrashContent = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    stackView: React.PropTypes.string.isRequired,
    stackType: React.PropTypes.string,
    newestFirst: React.PropTypes.bool.isRequired,
    exception: React.PropTypes.object,
    stacktrace: React.PropTypes.object,
  },

  renderException() {
    const {event, stackView, stackType, newestFirst, exception} = this.props;
    return (
      stackView === 'raw' ?
        <RawExceptionContent
          type={stackType}
          values={exception.values}
          platform={event.platform} /> :
        <ExceptionContent
          type={stackType}
          view={stackView}
          values={exception.values}
          platform={event.platform}
          newestFirst={newestFirst} />
    );
  },

  renderStacktrace() {
    const {event, stackView, newestFirst, stacktrace} = this.props;
    return (
      stackView === 'raw' ?
        <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}</pre> :
        <StacktraceContent
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === 'full'}
          platform={event.platform}
          newestFirst={newestFirst} />
    );
  },

  render() {
    if (this.props.exception) {
      return this.renderException();
    }
    if (this.props.stacktrace) {
      return this.renderStacktrace();
    }
  }
});

export default CrashContent;
