import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import toPercent from 'sentry/utils/number/toPercent';
import type {VideoEvent} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  durationMs: number;
  startTimestampMs: number;
  videoEvents: VideoEvent[];
}

export default function TimelineGaps({durationMs, startTimestampMs, videoEvents}: Props) {
  const organization = useOrganization();

  const gaps = useMemo(() => {
    const ranges: {left: string; width: string}[] = [];
    let previousVideoEnd = startTimestampMs;

    // create gap in timeline when there is a gap between video events larger than 1.1s
    for (const video of videoEvents) {
      if (video.timestamp - previousVideoEnd > 1100) {
        ranges.push({
          left: toPercent((previousVideoEnd - startTimestampMs) / durationMs),
          width: toPercent((video.timestamp - previousVideoEnd) / durationMs),
        });
      }
      previousVideoEnd = video.timestamp + video.duration;
    }

    // add gap at the end if the last video segment ends before the replay ends
    if (videoEvents.length && previousVideoEnd < startTimestampMs + durationMs) {
      ranges.push({
        left: toPercent((previousVideoEnd - startTimestampMs) / durationMs),
        width: toPercent(durationMs / durationMs),
      });
    }

    return ranges;
  }, [durationMs, startTimestampMs, videoEvents]);

  useEffect(() => {
    trackAnalytics('replay.gaps_detected', {
      gaps: gaps.length,
      max_gap: Math.max(...gaps.map(obj => parseFloat(obj.width))),
      replay_duration: durationMs,
      organization,
    });
  }, [durationMs, organization, gaps]);

  // TODO: Fix tooltip position to follow mouse (it currently goes off the timeline when zoomed too much)
  return (
    <Fragment>
      {gaps.map(rangeCss => {
        return (
          <Range key={`${rangeCss.left}-${rangeCss.width}`} style={rangeCss}>
            <Tooltip
              title={t('Video Unavailable')}
              isHoverable
              containerDisplayMode="block"
              position="top"
            >
              <Gap />
            </Tooltip>
          </Range>
        );
      })}
    </Fragment>
  );
}

const Range = styled('div')`
  position: absolute;
`;

const Gap = styled('div')`
  background: ${p => p.theme.gray400};
  opacity: 16%;
  height: 20px;
  width: 100%;
`;
