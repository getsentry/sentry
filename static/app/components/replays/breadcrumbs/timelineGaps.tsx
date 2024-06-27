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

export default function TimelineGaps({durationMs, frames, width}: Props) {
  const markerWidth = frames.length < 200 ? 4 : frames.length < 500 ? 6 : 10;

  const totalColumns = Math.floor(width / markerWidth);
  const framesByColStart = getFramesByColumn(
    durationMs,
    frames.filter(f => isBackgroundFrame(f)),
    totalColumns
  );
  const framesByColEnd = getFramesByColumn(
    durationMs,
    frames.filter(f => isForegroundFrame(f)),
    totalColumns
  );
  const range = (start, stop) =>
    Array.from({length: (stop - start) / 1}, (_, i) => start + i);

  const gapCol: number[] = [];
  const startKeys = framesByColStart.keys();
  const endKeys = framesByColEnd.keys();
  let start = startKeys.next();
  let end = endKeys.next();

  while (!start.done) {
    while (start.value > end.value) {
      console.log(start.value, end.value);
      end = endKeys.next();
      if (end.done) {
        end.value = totalColumns - 1;
      }
    }
    gapCol.push(...range(start.value, end.value ?? totalColumns));
    console.log(range(start.value, end.value), start.value, end.value);
    start = startKeys.next();
    end = endKeys.next();
  }

  console.log(gapCol, framesByColStart, framesByColEnd);
  return (
    <Timeline.Columns totalColumns={totalColumns} remainder={0}>
      {Array.from(gapCol).map(column => (
        <Gap key={column} column={column} />
      ))}
    </Timeline.Columns>
  );
}

const Gap = styled(Timeline.Col)<{column: number}>`
  grid-column: ${p => Math.floor(p.column)};
  background: ${p => p.theme.red300};
  text-align: right;
  line-height: 14px;
  opacity: 50%;
`;
