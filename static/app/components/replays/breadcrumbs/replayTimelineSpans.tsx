import {memo, useCallback} from 'react';
import styled from '@emotion/styled';

import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {divide, flattenFrames} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {SpanFrame} from 'sentry/utils/replays/types';

type Props = {
  /**
   * Duration, in milliseconds, of the timeline
   */
  durationMs: number;

  /**
   * The spans to render into the timeline
   */
  frames: SpanFrame[];

  /**
   * Timestamp when the timeline begins, in milliseconds
   */
  startTimestampMs: number;

  /**
   * Extra classNames
   */
  className?: string;
};

function ReplayTimelineSpans({className, durationMs, frames, startTimestampMs}: Props) {
  const flattened = flattenFrames(frames);
  const {setActiveTab} = useActiveReplayTab();
  const isDark = ConfigStore.get('theme') === 'dark';

  const handleClick = useCallback(() => setActiveTab(TabKey.NETWORK), [setActiveTab]);

  return (
    <Spans isDark={isDark} className={className}>
      {flattened.map((span, i) => {
        const sinceStart = span.startTimestamp - startTimestampMs;
        const startPct = divide(sinceStart, durationMs);
        const widthPct = divide(span.duration, durationMs);

        return (
          <Tooltip
            key={i}
            title={
              <CountTooltipContent>
                <dt>{t('Network Requests:')}</dt>
                <dd>{span.frameCount}</dd>
                <dt>{t('Duration:')}</dt>
                <dd>{span.duration.toLocaleString()}ms</dd>
              </CountTooltipContent>
            }
            skipWrapper
            position="bottom"
          >
            <Span
              style={{
                left: toPercent(startPct),
                width: toPercent(widthPct),
              }}
              onClick={handleClick}
            />
          </Tooltip>
        );
      })}
    </Spans>
  );
}

const Spans = styled('ul')<{isDark: boolean}>`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  height: ${space(1.5)};
  margin-bottom: ${space(0.5)};
  position: relative;
  pointer-events: none;

  & > li {
    background: ${p => (p.isDark ? p.theme.charts.colors[5] : p.theme.charts.colors[0])};
  }
`;

const Span = styled('li')`
  cursor: pointer;
  display: block;
  position: absolute;
  min-width: 1px;
  height: 100%;
  border-radius: 2px;
  pointer-events: auto;
`;

export default memo(ReplayTimelineSpans);
