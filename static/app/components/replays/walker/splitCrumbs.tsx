import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import TextOverflow from 'sentry/components/textOverflow';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';

type MaybeOnClickHandler = null | ((frame: ReplayFrame) => void);

function splitCrumbs({
  frames,
  onClick,
  startTimestampMs,
}: {
  frames: ReplayFrame[];
  onClick: MaybeOnClickHandler;
  startTimestampMs: number;
}) {
  const firstFrame = frames.slice(0, 1);
  const summarizedFrames = frames.slice(1, -1);
  const lastFrame = frames.slice(-1);

  if (frames.length === 0) {
    // This one shouldn't overflow, but by including <TextOverflow> css stays
    // consistent with the other Segment types
    return [
      <Span key="summary">
        <TextOverflow>{tn('%s Page', '%s Pages', 0)}</TextOverflow>
      </Span>,
    ];
  }

  if (frames.length > 3) {
    return [
      <SummarySegment
        key="first"
        frames={firstFrame}
        startTimestampMs={startTimestampMs}
        onClick={onClick}
      />,
      <SummarySegment
        key="summary"
        frames={summarizedFrames}
        startTimestampMs={startTimestampMs}
        onClick={onClick}
      />,
      <SummarySegment
        key="last"
        frames={lastFrame}
        startTimestampMs={startTimestampMs}
        onClick={onClick}
      />,
    ];
  }

  return frames.map((frame, i) => (
    <SummarySegment
      key={i}
      frames={[frame]}
      startTimestampMs={startTimestampMs}
      onClick={onClick}
    />
  ));
}

function SummarySegment({
  frames,
  onClick,
  startTimestampMs,
}: {
  frames: ReplayFrame[];
  onClick: MaybeOnClickHandler;
  startTimestampMs: number;
}) {
  const {onMouseEnter, onMouseLeave} = useCrumbHandlers();

  const summaryItems = (
    <ScrollingList>
      {frames.map((frame, i) => (
        <li key={i}>
          <BreadcrumbItem
            frame={frame}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            startTimestampMs={startTimestampMs}
          />
        </li>
      ))}
    </ScrollingList>
  );

  const label =
    frames.length === 1
      ? getFrameDetails(frames[0]).description
      : tn('%s Page', '%s Pages', frames.length);
  return (
    <Span>
      <HalfPaddingHovercard body={summaryItems} position="right">
        <TextOverflow>{label}</TextOverflow>
      </HalfPaddingHovercard>
    </Span>
  );
}

const ScrollingList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  max-height: calc(100vh - 32px);
  overflow: scroll;
`;

const Span = styled('span')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 0;
`;

const HalfPaddingHovercard = styled(
  ({children, bodyClassName, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard bodyClassName={(bodyClassName ?? '') + ' half-padding'} {...props}>
      {children}
    </Hovercard>
  )
)`
  .half-padding {
    padding: ${space(0.5)};
  }
`;

export default splitCrumbs;
