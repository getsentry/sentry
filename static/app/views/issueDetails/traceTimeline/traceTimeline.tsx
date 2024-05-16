import {useRef} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';

import {TraceTimelineEvents} from './traceTimelineEvents';
import {EventItem} from './traceTimelineTooltip';
import {type TimelineEvent, useTraceTimelineEvents} from './useTraceTimelineEvents';

const twoIssues = 2;

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const organization = useOrganization();
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});
  const {isError, isLoading, traceEvents} = useTraceTimelineEvents({event});

  const hasTraceId = !!event.contexts?.trace?.trace_id;

  let timelineStatus: string | undefined;
  let issues: {id: number; project: string; title: string}[] = [];
  if (hasTraceId && !isLoading) {
    if (organization.features.includes('related-issues-issue-details-page')) {
      issues = getIssuesFromEvents(traceEvents);
      // When we have more than 2 issues regardless of the number of events we skip the timeline
      timelineStatus = issues.length > twoIssues ? 'shown' : 'empty';
    } else {
      timelineStatus = traceEvents.length > 1 ? 'shown' : 'empty';
    }
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
  if (isError || noEvents || onlySelfEvent || isLoading) {
    // display empty placeholder to reduce layout shift
    return null;
  }

  return (
    <ErrorBoundary mini>
      {timelineStatus === 'shown' ? (
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
      ) : (
        <Feature features="related-issues-issue-details-page">
          {issues.length === twoIssues && (
            <div>
              {traceEvents.map((traceEvent, index) => (
                <EventItem key={index} timelineEvent={traceEvent} />
              ))}
            </div>
          )}
        </Feature>
      )}
    </ErrorBoundary>
  );
}

function getIssuesFromEvents(
  events: TimelineEvent[]
): {id: number; project: string; title: string}[] {
  return events
    .filter(
      (event, index, self) =>
        event['issue.id'] !== undefined &&
        self.findIndex(e => e['issue.id'] === event['issue.id']) === index
    )
    .map(event => ({
      id: event['issue.id'],
      title: event.title,
      project: event.project,
    }));
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
