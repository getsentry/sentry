import {CSSProperties, forwardRef, MouseEvent} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import useUrlParams from 'sentry/utils/useUrlParams';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import {operationName} from 'sentry/views/replays/detail/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

const EMPTY_CELL = '\u00A0';

type Props = {
  columnIndex: number;
  handleClick: (span: NetworkSpan) => void;
  handleMouseEnter: (span: NetworkSpan) => void;
  handleMouseLeave: (span: NetworkSpan) => void;
  isCurrent: boolean;
  isHovered: boolean;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortNetwork>['sortConfig'];
  span: NetworkSpan;
  startTimestampMs: number;
  style: CSSProperties;
};

const NetworkTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      handleClick,
      handleMouseEnter,
      handleMouseLeave,
      isCurrent,
      isHovered,
      rowIndex,
      sortConfig,
      span,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    // Rows include the sortable header, the dataIndex does not
    const dataIndex = String(rowIndex - 1);

    const {currentTime} = useReplayContext();
    const {getParamValue, setParamValue} = useUrlParams('n_detail_row', '');
    const isDetailsOpen = getParamValue() === dataIndex;

    const startMs = span.startTimestamp * 1000;
    const endMs = span.endTimestamp * 1000;
    const statusCode = span.data.statusCode;

    const isByTimestamp = sortConfig.by === 'startTimestamp';
    const columnProps = {
      hasOccurred: isByTimestamp
        ? currentTime >= relativeTimeInMs(span.startTimestamp * 1000, startTimestampMs)
        : undefined,
      hasOccurredAsc: isByTimestamp ? sortConfig.asc : undefined,
      isCurrent,
      isDetailsOpen,
      isHovered,
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      onClick: () => setParamValue(dataIndex),
      onMouseEnter: () => handleMouseEnter(span),
      onMouseLeave: () => handleMouseLeave(span),
      ref,
      style,
    };

    // `data.responseBodySize` is from SDK version 7.44-7.45
    const size = span.data.size ?? span.data.response?.size ?? span.data.responseBodySize;

    const renderFns = [
      () => (
        <Cell {...columnProps}>
          <Text>{statusCode ? statusCode : EMPTY_CELL}</Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Tooltip
            title={span.description}
            isHoverable
            showOnlyOnOverflow
            overlayStyle={{maxWidth: '500px !important'}}
          >
            <Text>{span.description || EMPTY_CELL}</Text>
          </Tooltip>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Tooltip title={operationName(span.op)} isHoverable showOnlyOnOverflow>
            <Text>{operationName(span.op)}</Text>
          </Tooltip>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <Text>
            {size === undefined ? EMPTY_CELL : <FileSize base={10} bytes={size} />}
          </Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <Text>{`${(endMs - startMs).toFixed(2)}ms`}</Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <TimestampButton
            format="mm:ss.SSS"
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              handleClick(span);
            }}
            startTimestampMs={startTimestampMs}
            timestampMs={startMs}
          />
        </Cell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

const cellBackground = p => {
  if (p.isDetailsOpen) {
    return `background-color: ${p.theme.textColor};`;
  }
  if (p.hasOccurred === undefined && !p.isStatusError) {
    const color = p.isHovered ? p.theme.hover : 'inherit';
    return `background-color: ${color};`;
  }
  const color = p.isStatusError ? p.theme.alert.error.backgroundLight : 'inherit';
  return `background-color: ${color};`;
};

const cellBorder = p => {
  if (p.hasOccurred === undefined) {
    return null;
  }
  const color = p.isCurrent
    ? p.theme.purple300
    : p.isHovered
    ? p.theme.purple200
    : 'transparent';
  return p.hasOccurredAsc
    ? `border-bottom: 1px solid ${color};`
    : `border-top: 1px solid ${color};`;
};

const cellColor = p => {
  if (p.isDetailsOpen) {
    const colors = p.isStatusError
      ? [p.theme.alert.error.background]
      : [p.theme.background];
    return `color: ${p.hasOccurred !== false ? colors[0] : colors[0]};`;
  }
  const colors = p.isStatusError
    ? [p.theme.alert.error.borderHover, p.theme.alert.error.iconColor]
    : ['inherit', p.theme.gray300];

  return `color: ${p.hasOccurred !== false ? colors[0] : colors[1]};`;
};

const Cell = styled('div')<{
  hasOccurred: boolean | undefined;
  hasOccurredAsc: boolean | undefined;
  isCurrent: boolean;
  isDetailsOpen: boolean;
  isHovered: boolean;
  isStatusError: boolean;
  numeric?: boolean;
  onClick?: undefined | (() => void);
}>`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
  ${cellBorder}
  ${cellColor}

  ${p =>
    p.numeric &&
    `
    font-variant-numeric: tabular-nums;
    justify-content: flex-end;
  `};
`;

const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

export default NetworkTableCell;
