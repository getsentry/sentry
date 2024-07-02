import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {getFramesByColumn} from 'sentry/components/replays/utils';
import {
  isBackgroundFrame,
  isForegroundFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';

interface Props {
  durationMs: number;
  frames: ReplayFrame[];
  width: number;
}

// create gaps in the timeline by finding all columns between a background frame and foreground frame
// or background frame to end of replay
export default function TimelineGaps({durationMs, frames, width}: Props) {
  const markerWidth = frames.length < 200 ? 4 : frames.length < 500 ? 6 : 10;

  const totalColumns = Math.floor(width / markerWidth);
  const framesByCol = getFramesByColumn(
    durationMs,
    frames.filter(f => isBackgroundFrame(f) || isForegroundFrame(f)),
    totalColumns
  );

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
        if (start === -1 && 'category' in frame && frame.category === 'app.background') {
          start = column;
        }
        // gap only ends if background frame has been found
        if (start !== -1 && 'category' in frame && frame.category === 'app.foreground') {
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
        <Gap key={column} column={column} />
      ))}
    </Timeline.Columns>
  );
}

const Gap = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => p.column};
  background: ${p => p.theme.gray400};
  line-height: 14px;
  opacity: 16%;
`;
