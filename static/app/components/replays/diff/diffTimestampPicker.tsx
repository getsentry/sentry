import {useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCode} from 'sentry/icons/iconCode';
import {IconFile} from 'sentry/icons/iconFile';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import formatDuration from 'sentry/utils/duration/formatDuration';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type {BreadcrumbFrame, RecordingFrame} from 'sentry/utils/replays/types';
import {EventType, IncrementalSource} from 'sentry/utils/replays/types';

function isHydrateCrumb(item: BreadcrumbFrame | RecordingFrame): item is BreadcrumbFrame {
  return 'category' in item && item.category === 'replay.hydrate-error';
}

function isRRWebChangeFrame(frame: RecordingFrame) {
  return (
    frame.type === EventType.FullSnapshot ||
    (frame.type === EventType.IncrementalSnapshot &&
      frame.data.source === IncrementalSource.Mutation)
  );
}

export default function DiffTimestampPicker() {
  const {replay} = useDiffCompareContext();
  // const {replay, leftOffsetMs, setLeftOffsetMs, rightOffsetMs, setRightOffsetMs} =
  //   useDiffCompareContext();

  const optionRange = useMemo(() => {
    const rrwebFrames = replay.getRRWebFrames().filter(isRRWebChangeFrame);
    const hydrationCrumbs = replay.getBreadcrumbFrames().filter(isHydrateCrumb);

    const sorted = [...rrwebFrames, ...hydrationCrumbs].sort((a, b) =>
      a.timestamp > b.timestamp ? 1 : -1
    );
    const deduped = sorted.filter(
      (item, i, items) => i && items[i - 1].timestamp !== item.timestamp
    );

    const firstCrumbIdx = deduped.findIndex(isHydrateCrumb);
    const lastCrumbIdx = deduped.findLastIndex(isHydrateCrumb);
    const range = deduped.slice(
      Math.max(0, firstCrumbIdx - 5),
      Math.min(lastCrumbIdx + 5, deduped.length)
    );

    return range;
  }, [replay]);

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;

  return (
    <Wrapper>
      <List>
        {optionRange.map((item, i) =>
          isHydrateCrumb(item) ? (
            <Crumb key={i} crumb={item} startTimestampMs={startTimestampMs} />
          ) : (
            <Mutation key={i} frame={item} startTimestampMs={startTimestampMs} />
          )
        )}
      </List>
    </Wrapper>
  );
}

function Crumb({
  crumb,
  startTimestampMs,
}: {
  crumb: BreadcrumbFrame;
  startTimestampMs: number;
}) {
  const theme = useTheme();
  const {color, title, icon} = getFrameDetails(crumb);

  return (
    <Tooltip
      title={
        <LeftAligned>
          {title}
          <div>
            <ReplayTooltipTime
              timestampMs={crumb.timestampMs}
              startTimestampMs={startTimestampMs}
            />
          </div>
        </LeftAligned>
      }
    >
      <ListItem disabled priority="danger" borderless size="xs">
        <IconWrapper
          css={css`
            color: ${theme[color]};
          `}
        >
          {icon}
          {formatDuration({
            duration: [crumb.offsetMs, 'ms'],
            precision: 'ms',
            style: 'hh:mm:ss.sss',
          })}
        </IconWrapper>
      </ListItem>
    </Tooltip>
  );
}

function Mutation({
  frame,
  startTimestampMs,
}: {
  frame: RecordingFrame;
  startTimestampMs: number;
}) {
  const {leftTimestampMs, rightTimestampMs} = useDiffCompareContext();

  const name =
    frame.type === EventType.FullSnapshot
      ? t('Full Snapshot')
      : t('Incremental Snapshot');
  const icon =
    frame.type === EventType.FullSnapshot ? (
      <IconFile color="gray500" size="sm" />
    ) : (
      <IconCode color="gray500" size="sm" />
    );

  const isBefore = leftTimestampMs === Number(frame.timestamp);
  const isAfter = rightTimestampMs === Number(frame.timestamp);

  return (
    <Tooltip
      title={
        <LeftAligned>
          {name}
          <div>
            <ReplayTooltipTime
              timestampMs={frame.timestamp}
              startTimestampMs={startTimestampMs}
            />
          </div>
        </LeftAligned>
      }
    >
      <ListItem
        data-before={isBefore ? 'true' : undefined}
        data-after={isAfter ? 'true' : undefined}
        size="xs"
      >
        <IconWrapper>
          {icon}
          {formatDuration({
            duration: [Math.abs(frame.timestamp - startTimestampMs), 'ms'],
            precision: 'ms',
            style: 'hh:mm:ss.sss',
          })}
        </IconWrapper>
      </ListItem>
    </Tooltip>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: center;
`;

const LeftAligned = styled('div')`
  text-align: left;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const IconWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.75)};
  align-items: center;
`;

const List = styled('div')`
  display: flex;
  flex-direction: row;

  gap: ${space(1)};
`;

const ListItem = styled(Button)`
  font-variant-numeric: tabular-nums;

  border: 1px solid transparent;
  background-color: transparent;

  &[data-before='true'] {
    border-color: ${p => p.theme.red400};
    background-color: ${p => p.theme.red100};
  }
  &[data-after='true'] {
    border-color: ${p => p.theme.green400};
    background-color: ${p => p.theme.green100};
  }
`;
