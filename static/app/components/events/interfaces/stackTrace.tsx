import {
  StacktraceContext,
  useStacktraceContext,
} from 'sentry/components/events/interfaces/stackTraceContext';
import {TraceEventDataSection} from 'sentry/components/events/traceEventDataSection';
import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/platform';
import type {Project} from 'sentry/types/project';

import {StackTraceContent} from './crashContent/stackTrace';
import {NoStackTraceMessage} from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: NonNullable<ExceptionValue['stacktrace']>;
  event: Event;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
};

function StandaloneStackTraceContent({
  event,
  data,
  groupingCurrentLevel,
  platform,
}: Pick<Props, 'event' | 'data' | 'groupingCurrentLevel'> & {
  platform: PlatformKey;
}) {
  const {isNewestFramesFirst, stackView} = useStacktraceContext();

  const entryIndex = event.entries.findIndex(
    eventEntry => eventEntry.type === EntryType.STACKTRACE
  );
  const meta = event._meta?.entries?.[entryIndex]?.data;

  return (
    <StackTraceContent
      meta={meta}
      event={event}
      platform={platform}
      stacktrace={data}
      groupingCurrentLevel={groupingCurrentLevel}
      newestFirst={isNewestFramesFirst}
      stackView={stackView}
    />
  );
}

function getStandaloneStackTraceData({
  projectSlug,
  event,
  data,
}: Pick<Props, 'projectSlug' | 'event' | 'data'>) {
  const framePlatform = data.frames?.find(frame => !!frame.platform)?.platform;
  const platform = framePlatform ?? event.platform ?? 'other';
  const hasNonAppFrames = !!data.frames?.some(frame => !frame.inApp);
  return {
    context: {
      projectSlug,
      forceFullStackTrace: hasNonAppFrames ? !data.hasSystemFrames : true,
      defaultIsNewestFramesFirst: isStacktraceNewestFirst(),
      hasSystemFrames: data.hasSystemFrames,
    },
    actions: {
      projectSlug,
      event,
      eventId: event.id,
      platform,
      stackTraceNotFound: !(data.frames ?? []).length,
      hasMinified: false,
      hasVerboseFunctionNames: !!data.frames?.some(
        frame =>
          !!frame.rawFunction && !!frame.function && frame.rawFunction !== frame.function
      ),
      hasAbsoluteFilePaths: !!data.frames?.some(frame => !!frame.filename),
      hasAbsoluteAddresses: !!data.frames?.some(frame => !!frame.instructionAddr),
      hasNewestFirst: (data.frames ?? []).length > 1,
    },
  };
}

export function StackTrace(props: Props) {
  const trace = getStandaloneStackTraceData(props);
  return (
    <StacktraceContext {...trace.context}>
      <TraceEventDataSection
        {...trace.actions}
        type={EntryType.STACKTRACE}
        title={t('Stack Trace')}
      >
        {trace.actions.stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <StandaloneStackTraceContent {...props} platform={trace.actions.platform} />
        )}
      </TraceEventDataSection>
    </StacktraceContext>
  );
}
