import {CSSProperties, Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconRefresh} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  index: number;
  onDimensionChange: OnDimensionChange;
  startTimestampMs: number;
  style: CSSProperties;
  traceRow: ReplayTraceRow;
}

export default function PerfRow({
  currentHoverTime,
  currentTime,
  index,
  onDimensionChange,
  startTimestampMs,
  style,
  traceRow,
}: Props) {
  const {lcpFrames, replayFrame: frame, paintFrames, flattenedTraces} = traceRow;
  const {color, description, title, icon} = getFrameDetails(frame);
  const lcp = lcpFrames.length ? getFrameDetails(lcpFrames[0]) : null;

  const handleDimensionChange = useCallback(
    () => onDimensionChange(index),
    [onDimensionChange, index]
  );

  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const handleClickTimestamp = useCallback(
    () => onClickTimestamp(frame),
    [onClickTimestamp, frame]
  );
  const handleMouseEnter = useCallback(() => onMouseEnter(frame), [onMouseEnter, frame]);
  const handleMouseLeave = useCallback(() => onMouseLeave(frame), [onMouseLeave, frame]);

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      <Vertical style={{gap: space(1)}}>
        <Horizontal style={{gap: space(1)}}>
          <IconWrapper color={color} hasOccurred={hasOccurred}>
            {icon}
          </IconWrapper>
          <Vertical style={{flexGrow: 1}}>
            <Title hasOccurred={hasOccurred}>{title}</Title>
            <Description title={description} showOnlyOnOverflow>
              {description}
            </Description>
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
            onClick={handleClickTimestamp}
            startTimestampMs={startTimestampMs}
            timestampMs={frame.timestampMs}
          />
        </Horizontal>
        {flattenedTraces.map((flatTrace, i) => (
          <TraceGrid
            key={i}
            flattenedTrace={flatTrace}
            onDimensionChange={handleDimensionChange}
          />
        ))}
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
  overflow-x: hidden;
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

const Description = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const IconLabel = styled('span')`
  display: flex;
  align-items: center;
  align-self: baseline;
  gap: 4px;
`;
