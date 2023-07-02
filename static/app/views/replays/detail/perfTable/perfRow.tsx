import {CSSProperties, useCallback} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {space} from 'sentry/styles/space';
import type EventView from 'sentry/utils/discover/eventView';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import {OnDimensionChange} from 'sentry/views/replays/detail/useVirtualListDimentionChange';

interface Props {
  currentHoverTime: number | undefined;
  currentTime: number;
  eventView: EventView | null;
  startTimestampMs: number;
  style: CSSProperties;
  traceRow: ReplayTraceRow;
  onDimensionChange?: OnDimensionChange;
}

export default function PerfRow({
  currentHoverTime,
  currentTime,
  eventView,
  startTimestampMs,
  style,
  traceRow,
}: Props) {
  const frame = traceRow.replayFrame;
  const location = useLocation();
  const organization = useOrganization();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const onClickTimestamp = useCallback(() => handleClick(frame), [handleClick, frame]);
  const onMouseEnter = useCallback(
    () => handleMouseEnter(frame),
    [handleMouseEnter, frame]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(frame),
    [handleMouseLeave, frame]
  );

  const {color, title, type} = getFrameDetails(frame);

  const hasOccurred = frame ? currentTime >= frame.offsetMs : false;
  const isBeforeHover = frame
    ? currentHoverTime === undefined || currentHoverTime >= frame.offsetMs
    : false;

  return (
    <PerfListItem
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined && isBeforeHover,
        afterHoverTime: currentHoverTime !== undefined && !isBeforeHover,
      })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <IconWrapper color={color} hasOccurred={hasOccurred}>
        <BreadcrumbIcon type={type} />
      </IconWrapper>
      <List>
        <Row>
          <Title>{title}</Title>
          <TimestampButton
            onClick={onClickTimestamp}
            startTimestampMs={startTimestampMs}
            timestampMs={frame.timestampMs}
          />
        </Row>
        {traceRow.traces.length ? (
          <StyledTraceView
            meta={null}
            traces={traceRow.traces ?? null}
            location={location}
            organization={organization}
            traceEventView={eventView!}
            traceSlug="Replay"
          />
        ) : null}
      </List>
    </PerfListItem>
  );
}

const PerfListItem = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1.5)};

  /* Overridden in TabItemContainer, depending on *CurrentTime and *HoverTime classes */
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
`;

const List = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
`;

const Row = styled('div')`
  display: flex;
  flex-direction: row;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Title = styled('span')<{hasOccurred?: boolean}>`
  color: ${p => (p.hasOccurred ? p.theme.gray400 : p.theme.gray300)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
  text-transform: capitalize;
  ${p => p.theme.overflowEllipsis};
`;

const StyledTraceView = styled(TraceView)`
  height: auto;
`;
