import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import RawExceptionContent from 'app/components/events/interfaces/rawExceptionContent';
import ExceptionContent from 'app/components/events/interfaces/exceptionContent';
import {STACK_VIEW, STACK_TYPE} from 'app/types/stacktrace';
import {PlatformType, Project, ExceptionType, Event} from 'app/types';

type Props = {
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  projectId: Project['id'];
  exception: {
    excOmitted: any | null;
    hasSystemFrames: boolean;
    values: Array<ExceptionType>;
  };
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
};

const Exception = ({
  stackView,
  stackType,
  projectId,
  exception,
  event,
  newestFirst,
  platform = 'other',
}: Props) => (
  <ErrorBoundary mini>
    {stackView === STACK_VIEW.RAW ? (
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
    )}
  </ErrorBoundary>
);

export default Exception;
