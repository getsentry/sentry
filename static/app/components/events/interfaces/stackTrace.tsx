import {
  StacktraceContext,
  useStacktraceContext,
} from 'sentry/components/events/interfaces/stackTraceContext';
import {TraceEventDataSection} from 'sentry/components/events/traceEventDataSection';
import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey, Project} from 'sentry/types/project';

import {StackTraceContent} from './crashContent/stackTrace';
import {hasFlamegraphData} from './crashContent/stackTrace/flamegraph';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: NonNullable<ExceptionValue['stacktrace']>;
  event: Event;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

function StackTraceContentWrapper({
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

export function StackTrace({projectSlug, event, data, groupingCurrentLevel}: Props) {
  function getPlatform(): PlatformKey {
    const framePlatform = data.frames?.find(frame => !!frame.platform);
    return framePlatform?.platform ?? event.platform ?? 'other';
  }

  const platform = getPlatform();
  const stackTraceNotFound = !(data.frames ?? []).length;

  const hasNonAppFrames = !!data.frames?.some(frame => !frame.inApp);
  const hasFlamegraphDataForStackTrace = hasFlamegraphData(data.frames);

  return (
    <StacktraceContext
      projectSlug={projectSlug}
      forceFullStackTrace={hasNonAppFrames ? !data.hasSystemFrames : true}
      defaultIsNewestFramesFirst={isStacktraceNewestFirst()}
      hasSystemFrames={data.hasSystemFrames}
      hasFlamegraphData={hasFlamegraphDataForStackTrace}
    >
      <TraceEventDataSection
        type={EntryType.STACKTRACE}
        projectSlug={projectSlug}
        event={event}
        eventId={event.id}
        platform={platform}
        stackTraceNotFound={stackTraceNotFound}
        title={hasFlamegraphDataForStackTrace ? t('Flamegraph') : t('Stack Trace')}
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
        hasNewestFirst={(data.frames ?? []).length > 1}
        hasFlamegraphData={hasFlamegraphDataForStackTrace}
      >
        {stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <StackTraceContentWrapper
            event={event}
            data={data}
            groupingCurrentLevel={groupingCurrentLevel}
            platform={platform}
          />
        )}
      </TraceEventDataSection>
    </StacktraceContext>
  );
}
