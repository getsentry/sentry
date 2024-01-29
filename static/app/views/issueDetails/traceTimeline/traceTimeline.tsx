import {useRef} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import type {Event} from 'sentry/types';
import {useDimensions} from 'sentry/utils/useDimensions';

import {TraceTimelineEvents} from './traceTimelineEvents';
import {useTraceTimelineEvents} from './useTraceTimelineEvents';

interface TraceTimelineProps {
  event: Event;
}

export function TraceTimeline({event}: TraceTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: timelineRef});
  const {isError, isLoading} = useTraceTimelineEvents({event});

  if (isError) {
    // TODO: display placeholder to reduce layout shift
    return null;
  }

  return (
    <VisiblePanel>
      <Stacked ref={timelineRef}>
        <TimelineEventsContainer>
          {isLoading ? (
            <Placeholder />
          ) : (
            <TraceTimelineEvents event={event} width={width} />
          )}
        </TimelineEventsContainer>
      </Stacked>
    </VisiblePanel>
  );
}

const VisiblePanel = styled(Panel)`
  margin: 0;
  border: 0;
  overflow: hidden;
  background: ${p => p.theme.translucentInnerBorder};
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
  padding-top: 10px;
  padding-bottom: 10px;
`;
