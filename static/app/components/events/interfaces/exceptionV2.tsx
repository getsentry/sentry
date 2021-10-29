import styled from '@emotion/styled';

import {t} from 'app/locale';
import {ExceptionType, Group, PlatformType, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';

import TraceEventDataSection from '../traceEventDataSection';
import {DisplayOption} from '../traceEventDataSection/displayOptions';

import CrashContentException from './crashContent/exception';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type Props = {
  event: Event;
  type: string;
  data: ExceptionType;
  projectId: Project['id'];
  hasHierarchicalGrouping: boolean;
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
  const eventHasThreads = !!event.entries.find(entry => entry.type === 'threads');

  /* in case there are threads in the event data, we don't render the
   exception block.  Instead the exception is contained within the
   thread interface. */
  if (eventHasThreads) {
    return null;
  }

  const stackTraceNotFound = !(data.values ?? []).length;
  const platform = (event.platform ?? 'other') as PlatformType;

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
      hasMinified={!!data.values?.find(value => value.rawStacktrace)}
      hasVerboseFunctionNames={
        !!data.values?.find(
          value =>
            !!value.stacktrace?.frames?.find(
              frame =>
                defined(frame.rawFunction) &&
                defined(frame.function) &&
                frame.rawFunction !== frame.function
            )
        )
      }
      hasAbsoluteFilePaths={
        !!data.values?.find(
          value => !!value.stacktrace?.frames?.find(frame => defined(frame.filename))
        )
      }
      hasAbsoluteAddresses={
        !!data.values?.find(
          value =>
            !!value.stacktrace?.frames?.find(frame => defined(frame.instructionAddr))
        )
      }
      hasAppOnlyFrames={
        !!data.values?.find(
          value => !!value.stacktrace?.frames?.find(frame => defined(frame.inApp))
        )
      }
      hasNewestFirst={
        !!data.values?.find(value => (value.stacktrace?.frames ?? []).length > 1)
      }
      stackTraceNotFound={stackTraceNotFound}
      showPermalink
      wrapTitle={false}
    >
      {({raw, recentFirst, activeDisplayOptions}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContentException
            stackType={
              activeDisplayOptions.includes(DisplayOption.MINIFIED)
                ? STACK_TYPE.MINIFIED
                : STACK_TYPE.ORIGINAL
            }
            stackView={
              raw
                ? STACK_VIEW.RAW
                : activeDisplayOptions.includes(DisplayOption.FULL_STACK_TRACE)
                ? STACK_VIEW.FULL
                : STACK_VIEW.APP
            }
            projectId={projectId}
            newestFirst={recentFirst}
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
