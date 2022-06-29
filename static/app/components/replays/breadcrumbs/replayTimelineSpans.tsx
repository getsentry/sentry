import React from 'react';
import styled from '@emotion/styled';

import {divide, flattenSpans} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {ReplaySpan} from 'sentry/views/replays/types';

type Props = {
  /**
   * Duration, in milliseconds, of the timeline
   */
  duration: number;

  /**
   * The spans to render into the timeline
   */
  spans: ReplaySpan[];

  /**
   * Timestamp when the timeline begins, in milliseconds
   */
  startTimestamp: number;

  /**
   * Extra classNames
   */
  className?: string;
};

function ReplayTimelineEvents({className, duration, spans, startTimestamp}: Props) {
  const flattenedSpans = flattenSpans(spans);

  const startMs = startTimestamp * 1000;
  return (
    <Spans className={className}>
      {flattenedSpans.map((span, i) => {
        const sinceStart = span.startTimestamp - startMs;
        const startPct = divide(sinceStart, duration);
        const widthPct = divide(span.duration, duration);

        const requestsCount = tn(
          '%s network request',
          '%s network requests',
          span.spanCount
        );
        return (
          <Tooltip
            key={i}
            title={
              <React.Fragment>
                {requestsCount}
                <br />
                {span.duration.toFixed(2)}ms
              </React.Fragment>
            }
            skipWrapper
            disableForVisualTest
          >
            <Span startPct={startPct} widthPct={widthPct} />
          </Tooltip>
        );
      })}
    </Spans>
  );
}

const Spans = styled('ul')`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  height: ${space(3)};
  position: relative;
  pointer-events: none;
`;
// TODO(replay): sync colors like #865189 with chartPalette so there is consistency
const Span = styled('li')<{startPct: number; widthPct: number}>`
  display: block;
  position: absolute;
  top: 0;
  left: ${p => p.startPct * 100}%;
  min-width: 1px;
  width: ${p => p.widthPct * 100}%;
  height: 100%;
  background: #865189; /* plucked from static/app/constants/chartPalette.tsx */
  pointer-events: auto;
`;

export default React.memo(ReplayTimelineEvents);
