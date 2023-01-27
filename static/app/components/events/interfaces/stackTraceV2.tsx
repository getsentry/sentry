import CrashContent from 'sentry/components/events/interfaces/crashContent';
import {t} from 'sentry/locale';
import {Group, PlatformType, Project} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

import {PermalinkTitle, TraceEventDataSection} from '../traceEventDataSection';

import CrashContentStackTrace from './crashContent/stackTrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = Pick<
  CrashContentProps,
  'groupingCurrentLevel' | 'hasHierarchicalGrouping'
> & {
  data: NonNullable<CrashContentProps['stacktrace']>;
  event: Event;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function StackTraceV2({
  projectSlug,
  event,
  data,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const entryIndex = event.entries.findIndex(
    eventEntry => eventEntry.type === EntryType.STACKTRACE
  );

  const meta = event._meta?.entries?.[entryIndex]?.data;

  function getPlatform(): PlatformType {
    const framePlatform = data.frames?.find(frame => !!frame.platform);
    return framePlatform?.platform ?? event.platform ?? 'other';
  }

  const platform = getPlatform();
  const stackTraceNotFound = !(data.frames ?? []).length;

  return (
    <TraceEventDataSection
      type={EntryType.STACKTRACE}
      stackType={STACK_TYPE.ORIGINAL}
      projectSlug={projectSlug}
      eventId={event.id}
      platform={platform}
      stackTraceNotFound={stackTraceNotFound}
      recentFirst={isStacktraceNewestFirst()}
      fullStackTrace={!data.hasSystemFrames}
      title={<PermalinkTitle>{t('Stack Trace')}</PermalinkTitle>}
      wrapTitle={false}
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
      {({recentFirst, display, fullStackTrace}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContentStackTrace
            meta={meta}
            event={event}
            platform={platform}
            stackView={
              display.includes('raw-stack-trace')
                ? STACK_VIEW.RAW
                : fullStackTrace
                ? STACK_VIEW.FULL
                : STACK_VIEW.APP
            }
            newestFirst={recentFirst}
            stacktrace={data}
            groupingCurrentLevel={groupingCurrentLevel}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
            nativeV2
          />
        )
      }
    </TraceEventDataSection>
  );
}
