import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getFramesByColumn} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {
  isBackgroundFrame,
  isForegroundFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';

interface Props {
  durationMs: number;
  frames: ReplayFrame[];
  totalFrames: number;
  width: number;
}

// create gaps in the timeline by finding all columns between a background frame and foreground frame
// or background frame to end of replay
export default function TimelineGaps({durationMs, frames, totalFrames, width}: Props) {
  const markerWidth = totalFrames < 200 ? 4 : totalFrames < 500 ? 6 : 10;
  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(durationMs, frames, totalColumns);

  // returns all numbers in the range, exclusive of start and inclusive of stop
  const range = (start, stop) =>
    Array.from({length: stop - start}, (_, i) => start + i + 1);

  const gapCol: number[] = [];

  const gapFrames = framesByCol.entries();
  let currFrame = gapFrames.next();

  while (!currFrame.done) {
    let start = -1;
    let end = -1;

    // iterate through all frames until we have a start (background frame) and end (foreground frame) of gap or no more frames
    while ((start === -1 || end === -1) && !currFrame.done) {
      const [column, colFrame] = currFrame.value;
      for (const frame of colFrame) {
        // only considered start of gap if background frame hasn't been found yet
        if (start === -1 && isBackgroundFrame(frame)) {
          start = column;
        }
        // gap only ends if background frame has been found
        if (start !== -1 && isForegroundFrame(frame)) {
          end = column;
        }
      }
      currFrame = gapFrames.next();
    }

    // create gap if we found have start (background frame) and end (foreground frame)
    if (start !== -1 && end !== -1) {
      gapCol.push(...range(start, end));
    }
    // if we have start but no end, that means we have a gap until end of replay
    if (start !== -1 && end === -1) {
      gapCol.push(...range(start, totalColumns));
    }
  }

  return (
    <Timeline.Columns totalColumns={totalColumns} remainder={0}>
      {gapCol.map(column => (
        <Column key={column} column={column}>
          <Tooltip title={t('App is suspended')} isHoverable containerDisplayMode="grid">
            <Gap style={{width: `${markerWidth}px`}} />
          </Tooltip>
        </Column>
      ))}
    </Timeline.Columns>
  );
}

const Column = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => p.column};
  line-height: 14px;
`;

const Gap = styled('span')`
  background: ${p => p.theme.gray400};
  opacity: 16%;
  height: 20px;
`;
