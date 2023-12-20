import {t} from 'sentry/locale';
import {ExceptionType, Group, PlatformKey, Project} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {StackType, StackView} from 'sentry/types/stacktrace';

import {PermalinkTitle, TraceEventDataSection} from '../traceEventDataSection';

import {ExceptionContent} from './crashContent/exception';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: ExceptionType;
  event: Event;
  hasHierarchicalGrouping: boolean;
  projectSlug: Project['slug'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

export function ExceptionV2({
  event,
  data,
  projectSlug,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const eventHasThreads = !!event.entries.some(entry => entry.type === EntryType.THREADS);

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

  function getPlatform(): PlatformKey {
    const dataValue = data.values?.find(
      value => !!value.stacktrace?.frames?.some(frame => !!frame.platform)
    );

    if (dataValue) {
      const framePlatform = dataValue.stacktrace?.frames?.find(frame => !!frame.platform);

      if (framePlatform?.platform) {
        return framePlatform.platform;
      }
    }

    return event.platform ?? 'other';
  }

  const stackTraceNotFound = !(data.values ?? []).length;
  const platform = getPlatform();

  return (
    <TraceEventDataSection
      title={<PermalinkTitle>{t('Stack Trace')}</PermalinkTitle>}
      type={EntryType.EXCEPTION}
      projectSlug={projectSlug}
      eventId={event.id}
      recentFirst={isStacktraceNewestFirst()}
      fullStackTrace={!data.hasSystemFrames}
      platform={platform}
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
      hasAppOnlyFrames={
        !!data.values?.some(
          value => !!value.stacktrace?.frames?.some(frame => frame.inApp !== true)
        )
      }
      hasNewestFirst={
        !!data.values?.some(value => (value.stacktrace?.frames ?? []).length > 1)
      }
      stackTraceNotFound={stackTraceNotFound}
      wrapTitle={false}
    >
      {({recentFirst, display, fullStackTrace}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <ExceptionContent
            stackType={
              display.includes('minified') ? StackType.MINIFIED : StackType.ORIGINAL
            }
            stackView={
              display.includes('raw-stack-trace')
                ? StackView.RAW
                : fullStackTrace
                ? StackView.FULL
                : StackView.APP
            }
            projectSlug={projectSlug}
            newestFirst={recentFirst}
            event={event}
            values={data.values}
            groupingCurrentLevel={groupingCurrentLevel}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
            meta={meta}
          />
        )
      }
    </TraceEventDataSection>
  );
}
