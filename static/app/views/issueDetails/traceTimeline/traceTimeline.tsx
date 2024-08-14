import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
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
  const {isError, isLoading, traceEvents, oneOtherIssueEvent} = useTraceTimelineEvents({
    event,
  });

  const hasTraceId = !!event.contexts?.trace?.trace_id;

  let timelineStatus: string | undefined = 'empty';
  if (hasTraceId && !isLoading) {
    // When we have another issue we skip the timeline
    timelineStatus = oneOtherIssueEvent ? 'empty' : 'shown';
  } else if (!hasTraceId) {
    timelineStatus = 'no_trace_id';
  }

  useRouteAnalyticsParams({
    trace_timeline_status: timelineStatus,
  });

  if (!hasTraceId) {
    return null;
  }

  const noEvents = !isLoading && traceEvents.length === 0;
  // Timelines with only the current event are not useful
  const onlySelfEvent =
    !isLoading &&
    traceEvents.length > 0 &&
    traceEvents.every(item => item.id === event.id);
  if (isError || noEvents || onlySelfEvent || isLoading) {
    // display empty placeholder to reduce layout shift
    return null;
  }

  return (
    <ErrorBoundary mini>
      {timelineStatus === 'shown' && (
        <Fragment>
          <TimelineWrapper>
            <div ref={timelineRef}>
              <TimelineEventsContainer>
                <TimelineOutline />
                {/* Sets a min width of 200 for testing */}
                <TraceTimelineEvents event={event} width={Math.max(width, 200)} />
              </TimelineEventsContainer>
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
        </Fragment>
      )}
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
