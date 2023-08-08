import {CSSProperties, Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import {IconClock, IconRefresh} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type EventView from 'sentry/utils/discover/eventView';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
// import {useLocation} from 'sentry/utils/useLocation';
// import useOrganization from 'sentry/utils/useOrganization';
// import TraceView from 'sentry/views/performance/traceDetails/traceView';
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
  eventView: _eventView,
  startTimestampMs,
  style,
  traceRow,
}: Props) {
  // const location = useLocation();
  // const organization = useOrganization();

  const {lcpFrame, replayFrame: frame, paintFrames, traces} = traceRow;
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
      <Vertical>
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
        <TxnGrid>
          <TraceRows
            indent={0}
            startTimestampMs={getStartTimestampMs(traces)}
            endTimestampMs={getEndTimestampMs(traces)}
            traces={traces ?? []}
          />
        </TxnGrid>
      </Vertical>
    </PerfListItem>
  );
}

function getStartTimestampMs(traces: TraceFullDetailed[]) {
  return (traces[0]?.start_timestamp ?? 0) * 1000;
}
function getEndTimestampMs(traces: TraceFullDetailed[]) {
  return traces.reduce(
    (max, trace) =>
      Math.max(
        max,
        trace.start_timestamp * 1000 + trace['transaction.duration'],
        getEndTimestampMs(trace.children)
      ),
    0
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

function TraceRows({
  endTimestampMs,
  indent,
  startTimestampMs,
  traces,
}: {
  endTimestampMs: number;
  indent: number;
  startTimestampMs: number;
  traces: TraceFullDetailed[];
}) {
  const emdash = '\u2013';

  return (
    <Fragment>
      {traces.map(trace => (
        <Fragment key={trace.event_id}>
          <TxnCell>
            <TxnLabel style={labelPosition(indent)}>
              <ProjectAvatar size={12} project={{slug: trace.project_slug}} />
              <span>
                <strong>{trace['transaction.op']}</strong> {emdash} {trace.transaction}
              </span>
            </TxnLabel>
          </TxnCell>
          <TxnCell>
            <TxnDurationBar
              barColor={pickBarColor(trace.transaction['transaction.op'])}
              style={barPosition(startTimestampMs, endTimestampMs, trace)}
            />
            <TxnDuration>{trace['transaction.duration']}</TxnDuration>
          </TxnCell>

          <TraceRows
            endTimestampMs={endTimestampMs}
            indent={indent + 1}
            startTimestampMs={startTimestampMs}
            traces={trace.children}
          />
        </Fragment>
      ))}
    </Fragment>
  );
}

function labelPosition(indent: number) {
  return {
    paddingLeft: `calc(${space(2)} * ${indent})`,
    transform: 'translate(0px, 0)',
  };
}

function barPosition(
  startTimestampMs: number,
  endTimestampMs: number,
  trace: TraceFullDetailed
) {
  const fullDuration = Math.abs(endTimestampMs - startTimestampMs) || 1;
  const sinceStart = trace.start_timestamp * 1000 - startTimestampMs;
  const duration = trace['transaction.duration'];
  return {
    left: toPercent(sinceStart / fullDuration),
    width: toPercent(duration / fullDuration),
  };
}

const TxnGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;

  font-size: ${p => p.theme.fontSizeRelativeSmall};

  & > :nth-child(4n + 1) {
    background: ${p => p.theme.backgroundTertiary};
  }
  & > :nth-child(4n + 2) {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const TxnCell = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-self: auto;

  padding: ${space(0.25)} ${space(0.5)};
  overflow: hidden;
`;

const TxnLabel = styled('div')`
  display: flex;
  gap: ${space(1)};

  align-items: center;
  white-space: nowrap;
`;

const TxnDuration = styled('div')`
  position: relative;
  display: flex;
  flex: auto 1 1;
  align-items: center;
  z-index: 1;
`;

const TxnDurationBar = styled('div')<{barColor: string}>`
  background: ${p => p.barColor};
  position: absolute;
  top: 0;
  user-select: none;
  min-width: 1px;
  --padding: ${space(1.5)};
  height: calc(100% - var(--padding));
  margin-block: calc(var(--padding) / 2);
  z-index: 0;
`;
