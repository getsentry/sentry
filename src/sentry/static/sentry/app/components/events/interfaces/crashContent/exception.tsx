import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import RawExceptionContent from 'app/components/events/interfaces/rawExceptionContent';
import ExceptionContent from 'app/components/events/interfaces/exceptionContent';
import {STACK_VIEW, STACK_TYPE} from 'app/types/stacktrace';
import {PlatformType, Project, Event, ExceptionType} from 'app/types';

type Props = {
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  projectId: Project['id'];
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
} & Pick<ExceptionType, 'values'>;

const Exception = ({
  stackView,
  stackType,
  projectId,
  values,
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
        values={values}
        platform={platform}
      />
    ) : (
      <ExceptionContent
        type={stackType}
        stackView={stackView}
        values={values}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
      />
    )}
  </ErrorBoundary>
);

export default Exception;
