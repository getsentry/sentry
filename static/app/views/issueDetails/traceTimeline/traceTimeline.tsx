import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {hasTraceTimelineFeature} from 'sentry/views/issueDetails/traceTimeline/utils';

import {TraceTimelineEvents} from './traceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';

const PLACEHOLDER_SIZE = '45px';

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});
  const hasFeature = hasTraceTimelineFeature(organization, user);
  const {isError, isLoading, data} = useTraceTimelineEvents({event}, hasFeature);

  if (!hasFeature || !event.contexts?.trace?.trace_id) {
    return null;
  }

  const noEvents = !isLoading && data.length === 0;
  // Timelines with only the current event are not useful
  const onlySelfEvent =
    !isLoading && data.length > 0 && data.every(item => item.id === event.id);
  if (isError || noEvents || onlySelfEvent) {
    // display empty placeholder to reduce layout shift
    return <div style={{height: PLACEHOLDER_SIZE}} data-test-id="trace-timeline-empty" />;
  }

  return (
    <ErrorBoundary mini>
      <Stacked ref={timelineRef}>
        {isLoading ? (
          <Placeholder height={PLACEHOLDER_SIZE} />
        ) : (
          <TimelineEventsContainer>
            <TimelineOutline />
            {/* Sets a min width of 200 for testing */}
            <TraceTimelineEvents event={event} width={Math.max(width, 200)} />
          </TimelineEventsContainer>
        )}
      </Stacked>
    </ErrorBoundary>
  );
}

/**
 * Displays the container the dots appear inside of
 */
const TimelineOutline = styled('div')`
  position: absolute;
  left: 0;
  top: 5px;
  width: 100%;
  height: 8px;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundSecondary};
`;

/**
 * Render all child elements directly on top of each other.
 *
 * This implementation does not remove the stack of elements from the document
 * flow, so width/height is reserved.
 *
 * An alternative would be to use `position:absolute;` in which case the size
 * would not be part of document flow and other elements could render behind.
 */
const Stacked = styled('div')`
  display: grid;
  grid-template: 1fr / 1fr;
  > * {
    grid-area: 1 / 1;
  }
  margin-top: ${space(1)};
`;

const TimelineEventsContainer = styled('div')`
  position: relative;
  height: 45px;
  padding-top: 10px;
`;
