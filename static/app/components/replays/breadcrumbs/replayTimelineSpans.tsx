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
  durationMS: number;

  /**
   * The spans to render into the timeline
   */
  spans: ReplaySpan[];

  /**
   * Timestamp when the timeline begins, in milliseconds
   */
  startTimestampMS: number;

  /**
   * Extra classNames
   */
  className?: string;
};

function ReplayTimelineEvents({className, durationMS, spans, startTimestampMS}: Props) {
  const flattenedSpans = flattenSpans(spans);

  return (
    <Spans className={className}>
      {flattenedSpans.map((span, i) => {
        const sinceStart = span.startTimestamp - startTimestampMS;
        const startPct = divide(sinceStart, durationMS);
        const widthPct = divide(span.duration, durationMS);

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
            position="bottom"
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

  height: ${space(1.5)};
  margin-bottom: ${space(0.5)};
  position: relative;
  pointer-events: none;
`;

const Span = styled('li')<{startPct: number; widthPct: number}>`
  display: block;
  position: absolute;
  left: ${p => p.startPct * 100}%;
  min-width: 1px;
  width: ${p => p.widthPct * 100}%;
  height: 100%;
  background: ${p => p.theme.charts.colors[0]};
  border-radius: 2px;
  pointer-events: auto;
`;

export default React.memo(ReplayTimelineEvents);
