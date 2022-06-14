import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {ExceptionType, Group, PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

import {TraceEventDataSection} from '../traceEventDataSection';

import CrashContentException from './crashContent/exception';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  data: ExceptionType;
  event: Event;
  hasHierarchicalGrouping: boolean;
  projectId: Project['id'];
  type: string;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

function Exception({
  event,
  type,
  data,
  projectId,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const eventHasThreads = !!event.entries.some(entry => entry.type === 'threads');

  /* in case there are threads in the event data, we don't render the
   exception block.  Instead the exception is contained within the
   thread interface. */
  if (eventHasThreads) {
    return null;
  }

  function getPlatform(): PlatformType {
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
      title={<Title>{t('Exception')}</Title>}
      type={type}
      stackType={STACK_TYPE.ORIGINAL}
      projectId={projectId}
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
      showPermalink
      wrapTitle={false}
    >
      {({sortBy, display, fullStackTrace}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContentException
            stackType={
              display.includes('minified') ? STACK_TYPE.MINIFIED : STACK_TYPE.ORIGINAL
            }
            stackView={
              display.includes('raw-stack-trace')
                ? STACK_VIEW.RAW
                : fullStackTrace
                ? STACK_VIEW.FULL
                : STACK_VIEW.APP
            }
            projectId={projectId}
            newestFirst={sortBy === 'recent-first'}
            event={event}
            platform={platform}
            values={data.values}
            groupingCurrentLevel={groupingCurrentLevel}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
          />
        )
      }
    </TraceEventDataSection>
  );
}

export default Exception;

const Title = styled('h3')`
  margin-bottom: 0;
`;
