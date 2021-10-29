import styled from '@emotion/styled';

import CrashContent from 'app/components/events/interfaces/crashContent';
import {t} from 'app/locale';
import {Group, PlatformType, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';

import TraceEventDataSection from '../traceEventDataSection';
import {DisplayOption} from '../traceEventDataSection/displayOptions';

import CrashContentStackTrace from './crashContent/stackTrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = Pick<
  CrashContentProps,
  'groupingCurrentLevel' | 'hasHierarchicalGrouping'
> & {
  event: Event;
  type: string;
  data: NonNullable<CrashContentProps['stacktrace']>;
  projectId: Project['id'];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideGuide?: boolean;
};

function StackTrace({
  projectId,
  event,
  data,
  type,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const stackTraceNotFound = !(data.frames ?? []).length;
  const platform = (event.platform ?? 'other') as PlatformType;

  return (
    <TraceEventDataSection
      type={type}
      stackType={STACK_TYPE.ORIGINAL}
      projectId={projectId}
      eventId={event.id}
      platform={platform}
      stackTraceNotFound={stackTraceNotFound}
      recentFirst={isStacktraceNewestFirst()}
      fullStackTrace={!data.hasSystemFrames}
      title={<Title>{t('Stack Trace')}</Title>}
      wrapTitle={false}
      hasMinified={false}
      hasVerboseFunctionNames={
        !!data.frames?.find(
          frame =>
            defined(frame.rawFunction) &&
            defined(frame.function) &&
            frame.rawFunction !== frame.function
        )
      }
      hasAbsoluteFilePaths={!!data.frames?.find(frame => defined(frame.filename))}
      hasAbsoluteAddresses={!!data.frames?.find(frame => defined(frame.instructionAddr))}
      hasAppOnlyFrames={!!data.frames?.find(frame => !!frame.inApp)}
      hasNewestFirst={(data.frames ?? []).length > 1}
      showPermalink
    >
      {({raw, recentFirst, activeDisplayOptions}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContentStackTrace
            event={event}
            platform={platform}
            stackView={
              raw
                ? STACK_VIEW.RAW
                : activeDisplayOptions.includes(DisplayOption.FULL_STACK_TRACE)
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

export default StackTrace;

const Title = styled('h3')`
  margin-bottom: 0;
`;
