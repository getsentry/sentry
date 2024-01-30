import {useRef} from 'react';
import styled from '@emotion/styled';

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
  const {isError, isLoading} = useTraceTimelineEvents({event});

  if (!hasTraceTimelineFeature(organization, user)) {
    return null;
  }

  if (isError) {
    // display placeholder to reduce layout shift
    return <div style={{height: 20}} />;
  }

  return (
    <VisiblePanel>
      <Stacked ref={timelineRef}>
        {isLoading ? (
          <Placeholder height="20px" />
        ) : (
          <TimelineEventsContainer>
            <TimelineOutline />
            {/* Sets a min width of 200 for testing */}
            <TraceTimelineEvents event={event} width={Math.max(width, 200)} />
          </TimelineEventsContainer>
        )}
      </Stacked>
    </VisiblePanel>
  );
}

const VisiblePanel = styled('div')`
  margin: 0;
  border: 0;
  overflow: hidden;
`;

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
  padding-top: 10px;
  padding-bottom: 10px;
`;
