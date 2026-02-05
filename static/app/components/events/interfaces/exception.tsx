import {Fragment} from 'react';

import {CommitRow} from 'sentry/components/commitRow';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {hasFlamegraphData} from 'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph';
import {StacktraceContext} from 'sentry/components/events/interfaces/stackTraceContext';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {TraceEventDataSection} from 'sentry/components/events/traceEventDataSection';
import {t} from 'sentry/locale';
import type {Event, ExceptionType} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {ExceptionContent} from './crashContent/exception';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: ExceptionType;
  event: Event;
  group: Group | undefined;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function Exception({
  event,
  data,
  projectSlug,
  group,
  groupingCurrentLevel,
}: Props) {
  const eventHasThreads = !!event.entries.some(entry => entry.type === EntryType.THREADS);
  const hasStreamlinedUI = useHasStreamlinedUI();

  // in case there are threads in the event data, we don't render the
  // exception block.  Instead the exception is contained within the
  // thread interface.
  if (eventHasThreads) {
    return null;
  }

  const entryIndex = event.entries.findIndex(
    eventEntry => eventEntry.type === EntryType.EXCEPTION
  );

  const meta = event._meta?.entries?.[entryIndex]?.data?.values;

  const stackTraceNotFound = !(data.values ?? []).length;

  const hasNonAppFrames = !!data.values?.some(value =>
    value.stacktrace?.frames?.some(frame => !frame.inApp)
  );

  const hasFlamegraphDataForException = !!data.values?.some(value =>
    hasFlamegraphData(value.stacktrace?.frames)
  );

  return (
    <StacktraceContext
      projectSlug={projectSlug}
      forceFullStackTrace={hasNonAppFrames ? !data.hasSystemFrames : true}
      defaultIsNewestFramesFirst={isStacktraceNewestFirst()}
      hasSystemFrames={data.hasSystemFrames}
      hasFlamegraphData={hasFlamegraphDataForException}
    >
      <TraceEventDataSection
        title={hasFlamegraphDataForException ? t('Flamegraph') : t('Stack Trace')}
        type={EntryType.EXCEPTION}
        projectSlug={projectSlug}
        event={event}
        eventId={event.id}
        platform={event.platform ?? 'other'}
        hasMinified={!!data.values?.some(value => value.rawStacktrace)}
        hasVerboseFunctionNames={
          !!data.values?.some(
            value =>
              !!value.stacktrace?.frames?.some(
                frame =>
                  !!frame.rawFunction &&
                  !!frame.function &&
                  frame.rawFunction !== frame.function
              )
          )
        }
        hasAbsoluteFilePaths={
          !!data.values?.some(
            value => !!value.stacktrace?.frames?.some(frame => !!frame.filename)
          )
        }
        hasAbsoluteAddresses={
          !!data.values?.some(
            value => !!value.stacktrace?.frames?.some(frame => !!frame.instructionAddr)
          )
        }
        hasNewestFirst={
          !!data.values?.some(value => (value.stacktrace?.frames ?? []).length > 1)
        }
        hasFlamegraphData={hasFlamegraphDataForException}
        stackTraceNotFound={stackTraceNotFound}
      >
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
            {hasStreamlinedUI && group && (
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
                    commitRow={CommitRow}
                  />
                </ErrorBoundary>
              </Fragment>
            )}
          </Fragment>
        )}
      </TraceEventDataSection>
    </StacktraceContext>
  );
}
