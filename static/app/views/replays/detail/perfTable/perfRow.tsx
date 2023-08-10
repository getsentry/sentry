import {CSSProperties, Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
// import {useDimensions} from 'sentry/utils/useDimensions';
// import {useLocation} from 'sentry/utils/useLocation';
// import useOrganization from 'sentry/utils/useOrganization';
import {IconClock, IconRefresh} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type EventView from 'sentry/utils/discover/eventView';
// import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TraceGrid from 'sentry/views/replays/detail/perfTable/traceGrid';
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
  eventView: _eventView,
  startTimestampMs,
  style,
  traceRow,
}: Props) {
  // const location = useLocation();
  // const organization = useOrganization();

  const {lcpFrame, replayFrame: frame, paintFrames, tracesFlattened} = traceRow;
  const {color, description, title, type} = getFrameDetails(frame);
  const lcp = lcpFrame ? getFrameDetails(lcpFrame) : null;

  useEffect(() => {
    if (traceRow.traces.length) {
      console.log({traceRow});
    }
  }, [traceRow]);

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
      <Vertical style={{gap: space(1)}}>
        <Horizontal style={{gap: space(1)}}>
          <IconWrapper color={color} hasOccurred={hasOccurred}>
            <BreadcrumbIcon type={type} />
          </IconWrapper>
          <Vertical style={{flexGrow: 1}}>
            <Title hasOccurred={hasOccurred}>{title}</Title>
            {description}
          </Vertical>
          <IconLabel>
            {lcp ? (
              <Fragment>
                <IconClock size="xs" />
                {tct('[lcp] LCP', {lcp: lcp.description})}
              </Fragment>
            ) : null}
          </IconLabel>
          <IconLabel>
            {paintFrames.length ? (
              <Fragment>
                <IconRefresh size="xs" />
                {tct('[count] paint events', {count: paintFrames.length})}
              </Fragment>
            ) : null}
          </IconLabel>
          <TimestampButton
            onClick={onClickTimestamp}
            startTimestampMs={startTimestampMs}
            timestampMs={frame.timestampMs}
          />
        </Horizontal>
        <TraceGrid tracesFlattened={tracesFlattened} />
      </Vertical>
    </PerfListItem>
  );
}

const PerfListItem = styled('div')`
  padding: ${space(1)} ${space(1.5)};

  /* Overridden in TabItemContainer, depending on *CurrentTime and *HoverTime classes */
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
`;

const Vertical = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Horizontal = styled('div')`
  display: flex;
  flex: auto 1 1;
  flex-direction: row;

  font-size: ${p => p.theme.fontSizeSmall};
  overflow: auto;
`;

const Title = styled('span')<{hasOccurred?: boolean}>`
  color: ${p => (p.hasOccurred ? p.theme.gray400 : p.theme.gray300)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
  text-transform: capitalize;
  ${p => p.theme.overflowEllipsis};
`;

const IconLabel = styled('span')`
  display: flex;
  align-items: center;
  align-self: baseline;
  gap: 4px;
`;
