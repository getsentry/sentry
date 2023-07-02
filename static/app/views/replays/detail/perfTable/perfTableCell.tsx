import {ComponentProps, CSSProperties, forwardRef} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {Location} from 'history';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {
  Cell,
  StyledTimestampButton,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import {formatPercentage} from 'sentry/utils/formatters';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

type Props = {
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  eventView: EventView;
  location: Location;
  maxVisibleDuration: number;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  onClickTimestamp: (row: ReplayTraceRow) => void;
  onMouseEnter: (row: ReplayTraceRow) => void;
  onMouseLeave: (row: ReplayTraceRow) => void;
  organization: Organization;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortNetwork>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
  traceRow: ReplayTraceRow;
};

const TraceTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      eventView,
      maxVisibleDuration,
      location,
      onClickCell,
      onClickTimestamp,
      onMouseEnter,
      onMouseLeave,
      organization,
      rowIndex,
      sortConfig,
      startTimestampMs,
      style,
      traceRow,
    }: Props,
    ref
  ) => {
    // Rows include the sortable header, the dataIndex does not
    const dataIndex = rowIndex - 1;

    // const {getParamValue} = useUrlParams('n_detail_row', '');
    // const isSelected = getParamValue() === String(dataIndex);

    const hasOccurred = traceRow.replayFrame
      ? currentTime >= traceRow.replayFrame.offsetMs
      : false;
    const isBeforeHover = traceRow.replayFrame
      ? currentHoverTime === undefined ||
        currentHoverTime >= traceRow.replayFrame.offsetMs
      : false;

    const isByTimestamp = sortConfig.by === 'startTimestamp';
    const isAsc = isByTimestamp ? sortConfig.asc : undefined;
    const columnProps = {
      className: classNames({
        beforeCurrentTime: isByTimestamp
          ? isAsc
            ? hasOccurred
            : !hasOccurred
          : undefined,
        afterCurrentTime: isByTimestamp
          ? isAsc
            ? !hasOccurred
            : hasOccurred
          : undefined,
        beforeHoverTime:
          isByTimestamp && currentHoverTime !== undefined
            ? isAsc
              ? isBeforeHover
              : !isBeforeHover
            : undefined,
        afterHoverTime:
          isByTimestamp && currentHoverTime !== undefined
            ? isAsc
              ? !isBeforeHover
              : isBeforeHover
            : undefined,
      }),
      hasOccurred: isByTimestamp ? hasOccurred : undefined,
      // isSelected,
      // isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      onClick: () => onClickCell({dataIndex, rowIndex}),
      onMouseEnter: () => onMouseEnter(traceRow),
      onMouseLeave: () => onMouseLeave(traceRow),
      ref,
      style,
    } as ComponentProps<typeof Cell>;

    if (traceRow.replayFrame) {
      const frame = traceRow.replayFrame;
      const {color, title, type} = getFrameDetails(frame);
      const renderFns = [
        () => (
          <Cell {...columnProps}>
            <Text>
              <IconWrapper color={color} hasOccurred={hasOccurred}>
                <BreadcrumbIcon type={type} />
              </IconWrapper>
              {title}
            </Text>
          </Cell>
        ),
        () => <Cell {...columnProps}>{/* trace duration */}</Cell>,
        () => (
          <Cell {...columnProps} numeric>
            <StyledTimestampButton
              format="mm:ss.SSS"
              onClick={() => {
                onClickTimestamp(traceRow);
              }}
              startTimestampMs={startTimestampMs}
              timestampMs={frame.timestampMs}
            />
          </Cell>
        ),
      ];
      return renderFns[columnIndex]();
    }

    const renderFns = [
      () => (
        <Cell {...columnProps}>
          <TraceView
            meta={null}
            traces={traceRow.traces}
            location={location}
            organization={organization}
            traceEventView={eventView!}
            traceSlug="Replay"
          />
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>
            <DurationBar ms={traceRow.durationMs} maxMs={maxVisibleDuration} />
          </Text>
        </Cell>
      ),
      () => <Cell {...columnProps}>{/* frame timestamp */}</Cell>,
    ];

    return renderFns[columnIndex]();
  }
);

function DurationBar({maxMs, ms}: {maxMs: number; ms: number}) {
  const width = formatPercentage(ms / maxMs);
  return (
    <PercentContainer>
      <PercentBar style={{width}} />
      {ms.toLocaleString()}ms
    </PercentContainer>
  );
}

const PercentContainer = styled('div')`
  position: relative;
  width: 300px;
  background: ${p => p.theme.backgroundSecondary};
  color: white;
  text-align: right;
`;
const PercentBar = styled('div')`
  background-color: ${p => p.theme.purple200};
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: ${p => p.theme.zIndex.initial};
`;

export default TraceTableCell;
