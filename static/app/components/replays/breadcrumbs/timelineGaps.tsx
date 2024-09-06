import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import toPercent from 'sentry/utils/number/toPercent';
import {
  getFrameOpOrCategory,
  isBackgroundFrame,
  isErrorFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  durationMs: number;
  frames: ReplayFrame[];
  startTimestampMs: number;
}

// create gaps in the timeline by finding all columns between a background frame and foreground frame
// or background frame to end of replay
export default function TimelineGaps({durationMs, startTimestampMs, frames}: Props) {
  const organization = useOrganization();
  const ranges: Array<{left: string; width: string}> = [];

  let start = -1;
  let end = -1;

  for (const currFrame of frames) {
    // add metrics for frame coming after a background frame to see how often we have bad data
    if (start !== -1) {
      trackAnalytics('replay.frame-after-background', {
        organization,
        frame: getFrameOpOrCategory(currFrame),
      });
    }

    // only considered start of gap if background frame hasn't been found yet
    if (start === -1 && isBackgroundFrame(currFrame)) {
      start = currFrame.timestampMs - startTimestampMs;
    }

    // gap only ends if a frame that's not a background frame or error frame has been found
    if (start !== -1 && !isBackgroundFrame(currFrame) && !isErrorFrame(currFrame)) {
      end = currFrame.timestampMs - startTimestampMs;
    }

    // create gap if we found have start (background frame) and end (another frame)
    if (start !== -1 && end !== -1) {
      ranges.push({
        left: toPercent(start / durationMs),
        width: toPercent((end - start) / durationMs),
      });
      start = -1;
      end = -1;
    }
  }

  // create gap if we still have start (background frame) until end of replay
  if (start !== -1) {
    ranges.push({
      left: toPercent(start / durationMs),
      width: toPercent((durationMs - start) / durationMs),
    });
  }

  // TODO: Fix tooltip position to follow mouse (it currently goes off the timeline when zoomed too much)
  return (
    <Fragment>
      {ranges.map(rangeCss => {
        return (
          <Range key={`${rangeCss.left}-${rangeCss.width}`} style={rangeCss}>
            <Tooltip
              title={t('App is suspended')}
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
