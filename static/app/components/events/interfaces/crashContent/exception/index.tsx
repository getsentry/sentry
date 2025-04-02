import ErrorBoundary from 'sentry/components/errorBoundary';
import {useStacktraceContext} from 'sentry/components/events/interfaces/astackTraceContext';
import type {Event, ExceptionType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {StackView} from 'sentry/types/stacktrace';

import {Content} from './content';
import RawContent from './rawContent';

type Props = {
  event: Event;
  projectSlug: Project['slug'];
  values: ExceptionType['values'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: Record<any, any>;
  threadId?: number;
};

export function ExceptionContent({
  projectSlug,
  values,
  event,
  groupingCurrentLevel,
  meta,
  threadId,
}: Props) {
  const {stackView, stackType, isNewestFramesFirst} = useStacktraceContext();
  return (
    <ErrorBoundary mini>
      {stackView === StackView.RAW ? (
        <RawContent
          eventId={event.id}
          projectSlug={projectSlug}
          type={stackType}
          values={values}
          platform={event.platform}
        />
      ) : (
        <Content
          type={stackType}
          stackView={stackView}
          values={values}
          projectSlug={projectSlug}
          newestFirst={isNewestFramesFirst}
          event={event}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          threadId={threadId}
        />
      )}
    </ErrorBoundary>
  );
}
