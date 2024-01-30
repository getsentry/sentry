import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import type {Event} from 'sentry/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {hasTraceTimelineFeature} from 'sentry/views/issueDetails/traceTimeline/utils';

import {TraceTimelineEvents} from './traceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});
  const hasFeature = hasTraceTimelineFeature(organization, user);
  const {isError, isLoading} = useTraceTimelineEvents({event}, hasFeature);

  if (!hasFeature) {
    return null;
  }

  if (isError) {
    // display placeholder to reduce layout shift
    return <div style={{height: 20}} />;
  }

  return (
    <ErrorBoundary mini>
      <div>
        <Stacked ref={timelineRef}>
          {isLoading ? (
            <Placeholder height="45px" />
          ) : (
            <TimelineEventsContainer>
              <TimelineOutline />
              {/* Sets a min width of 200 for testing */}
              <TraceTimelineEvents event={event} width={Math.max(width, 200)} />
            </TimelineEventsContainer>
          )}
        </Stacked>
      </div>
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
  height: 6px;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
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
`;

const TimelineEventsContainer = styled('div')`
  position: relative;
  height: 45px;
  padding-top: 10px;
`;
