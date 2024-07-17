import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import toPercent from 'sentry/utils/number/toPercent';
import {
  isBackgroundFrame,
  isForegroundFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';

interface Props {
  durationMs: number;
  frames: ReplayFrame[];
  startTimestampMs: number;
}

// create gaps in the timeline by finding all columns between a background frame and foreground frame
// or background frame to end of replay
export default function TimelineGaps({durationMs, startTimestampMs, frames}: Props) {
  const ranges: Array<{left: string; width: string}> = [];
  const gapFrames = frames.entries();
  let currFrame = gapFrames.next();

  while (!currFrame.done) {
    let start = -1;
    // if no foreground frame is found, it means the gap continues to end of replay
    let end = durationMs;

    // iterate through all frames until we have a start (background frame) and end (foreground frame) of gap or no more frames
    while ((start === -1 || end === durationMs) && !currFrame.done) {
      const [, frame] = currFrame.value;
      // only considered start of gap if background frame hasn't been found yet
      if (start === -1 && isBackgroundFrame(frame)) {
        start = frame.timestampMs - startTimestampMs;
      }
      // gap only ends if background frame has been found
      if (start !== -1 && isForegroundFrame(frame)) {
        end = frame.timestampMs - startTimestampMs;
      }
      currFrame = gapFrames.next();
    }

    // create gap if we found have start (background frame) and end (foreground frame) / end of replay
    if (start !== -1) {
      ranges.push({
        left: toPercent(start / durationMs),
        width: toPercent((end - start) / durationMs),
      });
    }
  }

  return (
    <Fragment>
      {ranges.map(rangeCss => {
        return (
          <Range key={JSON.stringify(rangeCss)} css={css``} style={rangeCss}>
            <Tooltip
              title={t('App is suspended')}
              isHoverable
              containerDisplayMode="block"
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

const Gap = styled('span')`
  background: ${p => p.theme.gray400};
  display: block;
  opacity: 16%;
  height: 20px;
  width: 100%;
`;
