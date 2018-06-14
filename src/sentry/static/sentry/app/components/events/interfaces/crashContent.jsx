import PropTypes from 'prop-types';
import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import ExceptionContent from 'app/components/events/interfaces/exceptionContent';
import RawExceptionContent from 'app/components/events/interfaces/rawExceptionContent';
import SentryTypes from 'app/proptypes';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';

class CrashContent extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    stackView: PropTypes.string.isRequired,
    stackType: PropTypes.string,
    newestFirst: PropTypes.bool.isRequired,
    exception: PropTypes.object,
    stacktrace: PropTypes.object,
  };

  renderException = () => {
    const {event, stackView, stackType, newestFirst, exception} = this.props;
    return stackView === 'raw' ? (
      <RawExceptionContent
        eventId={event.id}
        type={stackType}
        values={exception.values}
        platform={event.platform}
        release={event.release.version}
      />
    ) : (
      <ExceptionContent
        type={stackType}
        view={stackView}
        values={exception.values}
        platform={event.platform}
        newestFirst={newestFirst}
        release={event.release.version}
        event={event}
      />
    );
  };

  renderStacktrace = () => {
    const {event, stackView, newestFirst, stacktrace} = this.props;
    // console.log("the release, again")
    // this.props.event && console.log(this.props.event.release.version)
    return stackView === 'raw' ? (
      <pre className="traceback plain">
        {rawStacktraceContent(stacktrace, event.platform)}
      </pre>
    ) : (
      <StacktraceContent
        data={stacktrace}
        className="no-exception"
        includeSystemFrames={stackView === 'full'}
        platform={event.platform}
        event={event}
        newestFirst={newestFirst}
        release={event.release.version}
      />
    );
  };

  render() {
    window.props = this.props.event;
    // console.log("we're here", this.props.event.release.version);
    if (this.props.exception) {
      return <ErrorBoundary mini>{this.renderException()}</ErrorBoundary>;
    }
    if (this.props.stacktrace) {
      return <ErrorBoundary mini>{this.renderStacktrace()}</ErrorBoundary>;
    }
    return null;
  }
}

export default CrashContent;