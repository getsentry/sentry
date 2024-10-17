import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import toPercent from 'sentry/utils/number/toPercent';
import type {VideoEvent} from 'sentry/utils/replays/types';

interface Props {
  durationMs: number;
  startTimestampMs: number;
  videoEvents: VideoEvent[];
}

export default function TimelineGaps({durationMs, startTimestampMs, videoEvents}: Props) {
  const ranges: Array<{left: string; width: string}> = [];

  let start = startTimestampMs;

  // create gap in timeline when there is a gap between video events
  for (const video of videoEvents) {
    if (start < video.timestamp) {
      ranges.push({
        left: toPercent((start - startTimestampMs) / durationMs),
        width: toPercent((video.timestamp - start) / durationMs),
      });
    }
    start = video.timestamp + video.duration;
  }

  // add gap at the end if the last video segment ends before the replay ends
  if (videoEvents.length && start < startTimestampMs + durationMs) {
    ranges.push({
      left: toPercent((start - startTimestampMs) / durationMs),
      width: toPercent(durationMs / durationMs),
    });
  }

  // TODO: Fix tooltip position to follow mouse (it currently goes off the timeline when zoomed too much)
  return (
    <Fragment>
      {ranges.map(rangeCss => {
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
