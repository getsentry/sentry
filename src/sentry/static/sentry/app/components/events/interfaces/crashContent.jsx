import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import ExceptionContent from './exceptionContent';
import RawExceptionContent from './rawExceptionContent';

const CrashContent = React.createClass({
  propTypes: {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    stackView: PropTypes.string.isRequired,
    stackType: PropTypes.string,
    newestFirst: PropTypes.bool.isRequired,
    exception: PropTypes.object,
    stacktrace: PropTypes.object
  },

  renderException() {
    const {event, stackView, stackType, newestFirst, exception} = this.props;
    return stackView === 'raw'
      ? <RawExceptionContent
          eventId={event.id}
          type={stackType}
          values={exception.values}
          platform={event.platform}
        />
      : <ExceptionContent
          type={stackType}
          view={stackView}
          values={exception.values}
          platform={event.platform}
          newestFirst={newestFirst}
        />;
  },

  renderStacktrace() {
    const {event, stackView, newestFirst, stacktrace} = this.props;
    return stackView === 'raw'
      ? <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}
        </pre>
      : <StacktraceContent
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === 'full'}
          platform={event.platform}
          newestFirst={newestFirst}
        />;
  },

  render() {
    if (this.props.exception) {
      return this.renderException();
    }
    if (this.props.stacktrace) {
      return this.renderStacktrace();
    }
    return null;
  }
});

export default CrashContent;
