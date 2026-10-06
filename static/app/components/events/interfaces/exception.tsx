import {Fragment} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceContext} from 'sentry/components/events/interfaces/stackTraceContext';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {TraceEventDataSection} from 'sentry/components/events/traceEventDataSection';
import {t} from 'sentry/locale';
import type {Event, ExceptionType} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionDivider} from 'sentry/views/issueDetails/foldSection';

import {ExceptionContent} from './crashContent/exception';
import {NoStackTraceMessage} from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: ExceptionType;
  event: Event;
  group: Group | undefined;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
};

function getExceptionStackTraceData({
  event,
  data,
  projectSlug,
}: Pick<Props, 'event' | 'data' | 'projectSlug'>) {
  const hasNonAppFrames = !!data.values?.some(value =>
    value.stacktrace?.frames?.some(frame => !frame.inApp)
  );
  return {
    context: {
      projectSlug,
      forceFullStackTrace: hasNonAppFrames ? !data.hasSystemFrames : true,
      defaultIsNewestFramesFirst: isStacktraceNewestFirst(),
      hasSystemFrames: data.hasSystemFrames,
    },
    actions: {
      event,
      eventId: event.id,
      projectSlug,
      platform: event.platform ?? 'other',
      stackTraceNotFound: !(data.values ?? []).length,
      hasMinified: !!data.values?.some(value => value.rawStacktrace),
      hasVerboseFunctionNames: !!data.values?.some(value =>
        value.stacktrace?.frames?.some(
          frame =>
            !!frame.rawFunction &&
            !!frame.function &&
            frame.rawFunction !== frame.function
        )
      ),
      hasAbsoluteFilePaths: !!data.values?.some(value =>
        value.stacktrace?.frames?.some(frame => !!frame.filename)
      ),
      hasAbsoluteAddresses: !!data.values?.some(value =>
        value.stacktrace?.frames?.some(frame => !!frame.instructionAddr)
      ),
      hasNewestFirst: !!data.values?.some(
        value => (value.stacktrace?.frames ?? []).length > 1
      ),
    },
  };
}

export function Exception(props: Props) {
  // Thread rendering includes its associated exception.
  if (props.event.entries.some(entry => entry.type === EntryType.THREADS)) {
    return null;
  }
  const trace = getExceptionStackTraceData(props);
  return (
    <StacktraceContext {...trace.context}>
      <TraceEventDataSection
        {...trace.actions}
        title={t('Stack Trace')}
        type={EntryType.EXCEPTION}
      >
        <ExceptionStackTraceContent {...props} />
      </TraceEventDataSection>
    </StacktraceContext>
  );
}

function ExceptionStackTraceContent({
  event,
  data,
  projectSlug,
  group,
  groupingCurrentLevel,
}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.EXCEPTION);
  const meta = event._meta?.entries?.[entryIndex]?.data?.values;
  const stackTraceNotFound = !(data.values ?? []).length;
  return (
    <Fragment>
      {stackTraceNotFound ? (
        <NoStackTraceMessage />
      ) : (
        <Fragment>
          <ExceptionContent
            projectSlug={projectSlug}
            event={event}
            values={data.values}
            groupingCurrentLevel={groupingCurrentLevel}
            meta={meta}
          />
          {group && (
            <Fragment>
              {data.values && data.values.length > 1 && (
                <SectionDivider orientation="horizontal" />
              )}
              <ErrorBoundary
                mini
                message={t('There was an error loading the suspect commits')}
              >
                <SuspectCommits
                  projectSlug={projectSlug}
                  eventId={event.id}
                  group={group}
                />
              </ErrorBoundary>
            </Fragment>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}
