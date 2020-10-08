import React from 'react';
import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';
import ErrorBoundary from 'app/components/errorBoundary';
import ExceptionContent from 'app/components/events/interfaces/exceptionContent';
import RawExceptionContent from 'app/components/events/interfaces/rawExceptionContent';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import {Event, Project, PlatformType} from 'app/types';
import {Stacktrace, STACK_VIEW, STACK_TYPE} from 'app/types/stacktrace';

type Props = {
  event: Event;
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  projectId: Project['id'];
  newestFirst: boolean;
  exception?: Record<string, any>;
  stacktrace?: Stacktrace;
};

const CrashContent = ({
  event,
  stackView,
  stackType,
  newestFirst,
  projectId,
  ...props
}: Props) => {
  const platform = (event.platform ?? 'other') as PlatformType;

  const renderException = (exception: Record<string, any>) =>
    stackView === 'raw' ? (
      <RawExceptionContent
        eventId={event.id}
        projectId={projectId}
        type={stackType}
        values={exception.values}
        platform={platform}
      />
    ) : (
      <ExceptionContent
        type={stackType}
        stackView={stackView}
        values={exception.values}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
      />
    );

  const renderStacktrace = (stacktrace: Stacktrace) =>
    stackView === 'raw' ? (
      <pre className="traceback plain">
        {rawStacktraceContent(stacktrace, event.platform)}
      </pre>
    ) : (
      <StacktraceContent
        data={stacktrace}
        className="no-exception"
        includeSystemFrames={stackView === STACK_VIEW.FULL}
        platform={platform}
        event={event}
        newestFirst={newestFirst}
      />
    );

  let content: React.ReactElement | null = null;

  if (props.exception) {
    content = renderException(props.exception);
  }

  if (props.stacktrace) {
    content = renderStacktrace(props.stacktrace);
  }

  return content === null ? content : <ErrorBoundary mini>{content}</ErrorBoundary>;
};

CrashContent.propTypes = {
  event: SentryTypes.Event.isRequired,
  stackView: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  newestFirst: PropTypes.bool.isRequired,
  stackType: PropTypes.string,
  exception: PropTypes.object,
  stacktrace: PropTypes.object,
};
export default CrashContent;
