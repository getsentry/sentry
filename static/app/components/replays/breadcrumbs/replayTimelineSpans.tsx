import {Fragment, memo} from 'react';
import styled from '@emotion/styled';

import {divide, flattenSpans} from 'sentry/components/replays/utils';
import Tooltip from 'sentry/components/tooltip';
import {tn} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {ReplaySpan} from 'sentry/views/replays/types';

type Props = {
  /**
   * Duration, in milliseconds, of the timeline
   */
  durationMs: number;

  /**
   * The spans to render into the timeline
   */
  spans: ReplaySpan[];

  /**
   * Timestamp when the timeline begins, in milliseconds
   */
  startTimestampMs: number;

  /**
   * Extra classNames
   */
  className?: string;
};

function ReplayTimelineEvents({className, durationMs, spans, startTimestampMs}: Props) {
  const flattenedSpans = flattenSpans(spans);
  const {setActiveTab} = useActiveReplayTab();

  return (
    <Spans className={className}>
      {flattenedSpans.map((span, i) => {
        const sinceStart = span.startTimestamp - startTimestampMs;
        const startPct = divide(sinceStart, durationMs);
        const widthPct = divide(span.duration, durationMs);

        const requestsCount = tn(
          '%s network request',
          '%s network requests',
          span.spanCount
        );
        return (
          <Tooltip
            key={i}
            title={
              <Fragment>
                {requestsCount}
                <br />
                {span.duration.toFixed(2)}ms
              </Fragment>
            }
            skipWrapper
            disableForVisualTest
            position="bottom"
          >
            <Span
              isDark={ConfigStore.get('theme') === 'dark'}
              startPct={startPct}
              widthPct={widthPct}
              onClick={() => setActiveTab('network')}
            />
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

const Span = styled('li')<{isDark: boolean; startPct: number; widthPct: number}>`
  cursor: pointer;
  display: block;
  position: absolute;
  left: ${p => p.startPct * 100}%;
  min-width: 1px;
  width: ${p => p.widthPct * 100}%;
  height: 100%;
  background: ${p => (p.isDark ? p.theme.charts.colors[5] : p.theme.charts.colors[0])};
  border-radius: 2px;
  pointer-events: auto;
`;

export default memo(ReplayTimelineEvents);
