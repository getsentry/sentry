import {StacktraceContext} from 'sentry/components/events/interfaces/stacktraceContext';
import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey, Project} from 'sentry/types/project';

import {TraceEventDataSection} from '../traceEventDataSection';

import {StackTraceContent} from './crashContent/stackTrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: NonNullable<ExceptionValue['stacktrace']>;
  event: Event;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function StackTrace({projectSlug, event, data, groupingCurrentLevel}: Props) {
  const entryIndex = event.entries.findIndex(
    eventEntry => eventEntry.type === EntryType.STACKTRACE
  );

  const meta = event._meta?.entries?.[entryIndex]?.data;

  function getPlatform(): PlatformKey {
    const framePlatform = data.frames?.find(frame => !!frame.platform);
    return framePlatform?.platform ?? event.platform ?? 'other';
  }

  const platform = getPlatform();
  const stackTraceNotFound = !(data.frames ?? []).length;

  return (
    <StacktraceContext
      projectSlug={projectSlug}
      hasFullStackTrace={!data.hasSystemFrames}
      hasSystemFrames={data.hasSystemFrames}
    >
      <TraceEventDataSection
        type={EntryType.STACKTRACE}
        projectSlug={projectSlug}
        eventId={event.id}
        platform={platform}
        stackTraceNotFound={stackTraceNotFound}
        recentFirst={isStacktraceNewestFirst()}
        title={t('Stack Trace')}
        hasMinified={false}
        hasVerboseFunctionNames={
          !!data.frames?.some(
            frame =>
              !!frame.rawFunction &&
              !!frame.function &&
              frame.rawFunction !== frame.function
          )
        }
        hasAbsoluteFilePaths={!!data.frames?.some(frame => !!frame.filename)}
        hasAbsoluteAddresses={!!data.frames?.some(frame => !!frame.instructionAddr)}
        hasAppOnlyFrames={!!data.frames?.some(frame => frame.inApp !== true)}
        hasNewestFirst={(data.frames ?? []).length > 1}
      >
        {stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <StackTraceContent
            meta={meta}
            event={event}
            platform={platform}
            stacktrace={data}
            groupingCurrentLevel={groupingCurrentLevel}
          />
        )}
      </TraceEventDataSection>
    </StacktraceContext>
  );
}
