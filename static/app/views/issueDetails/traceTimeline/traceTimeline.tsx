import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useDimensions} from 'sentry/utils/useDimensions';

import {TraceTimelineEvents} from './traceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});
  const {isError, isLoading, traceEvents} = useTraceTimelineEvents({event});

  const hasTraceId = !!event.contexts?.trace?.trace_id;

  let timelineStatus: string | undefined;
  if (hasTraceId && !isLoading) {
    timelineStatus = traceEvents.length > 1 ? 'shown' : 'empty';
  } else if (!hasTraceId) {
    timelineStatus = 'no_trace_id';
  }

  useRouteAnalyticsParams(timelineStatus ? {trace_timeline_status: timelineStatus} : {});

  if (!hasTraceId) {
    return null;
  }

  const noEvents = !isLoading && traceEvents.length === 0;
  // Timelines with only the current event are not useful
  const onlySelfEvent =
    !isLoading &&
    traceEvents.length > 0 &&
    traceEvents.every(item => item.id === event.id);
  if (isError || noEvents || onlySelfEvent) {
    // display empty placeholder to reduce layout shift
    return <div style={{height: 36}} data-test-id="trace-timeline-empty" />;
  }

  return (
    <ErrorBoundary mini>
      <TimelineWrapper>
        <div ref={timelineRef}>
          {isLoading ? (
            <LoadingSkeleton>
              <Placeholder height="14px" />
              <Placeholder height="8px" />
            </LoadingSkeleton>
          ) : (
            <TimelineEventsContainer>
              <TimelineOutline />
              {/* Sets a min width of 200 for testing */}
              <TraceTimelineEvents event={event} width={Math.max(width, 200)} />
            </TimelineEventsContainer>
          )}
        </div>
        <QuestionTooltipWrapper>
          <QuestionTooltip
            size="sm"
            title={t(
              'This is a trace timeline showing all related events happening upstream and downstream of this event'
            )}
            position="bottom"
          />
        </QuestionTooltipWrapper>
      </TimelineWrapper>
    </ErrorBoundary>
  );
}

const TimelineWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: ${space(2)};
  margin-top: ${space(0.25)};
`;

const QuestionTooltipWrapper = styled('div')`
  margin-top: ${space(0.25)};
`;

/**
 * Displays the container the dots appear inside of
 */
const TimelineOutline = styled('div')`
  position: absolute;
  left: 0;
  top: 3.5px;
  width: 100%;
  height: 10px;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const TimelineEventsContainer = styled('div')`
  position: relative;
  height: 34px;
  padding-top: 10px;
`;

const LoadingSkeleton = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  padding: ${space(0.5)} 0 ${space(1)};
  height: 34px;
`;
