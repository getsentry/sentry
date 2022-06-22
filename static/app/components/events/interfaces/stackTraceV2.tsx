import styled from '@emotion/styled';

import CrashContent from 'sentry/components/events/interfaces/crashContent';
import {t} from 'sentry/locale';
import {Group, PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

import {TraceEventDataSection} from '../traceEventDataSection';

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
  projectId: Project['id'];
  type: string;
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
  function getPlatform(): PlatformType {
    const framePlatform = data.frames?.find(frame => !!frame.platform);
    return framePlatform?.platform ?? event.platform ?? 'other';
  }

  const platform = getPlatform();
  const stackTraceNotFound = !(data.frames ?? []).length;

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
      showPermalink
    >
      {({recentFirst, display, fullStackTrace}) =>
        stackTraceNotFound ? (
          <NoStackTraceMessage />
        ) : (
          <CrashContentStackTrace
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

export default StackTrace;

const Title = styled('h3')`
  margin-bottom: 0;
`;
