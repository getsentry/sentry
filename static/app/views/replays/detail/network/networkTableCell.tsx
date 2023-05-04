import {CSSProperties, forwardRef, MouseEvent, useMemo} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import FileSize from 'sentry/components/fileSize';
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
  currentHoverTime: number | undefined;
  currentTime: number;
  handleMouseEnter: (span: NetworkSpan) => void;
  handleMouseLeave: (span: NetworkSpan) => void;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  onClickTimestamp: (crumb: NetworkSpan) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortNetwork>['sortConfig'];
  span: NetworkSpan;
  startTimestampMs: number;
  style: CSSProperties;
};

type CellProps = {
  hasOccurred: boolean | undefined;
  isDetailsOpen: boolean;
  isStatusError: boolean;
  className?: string;
  numeric?: boolean;
  onClick?: undefined | (() => void);
};

const NetworkTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      handleMouseEnter,
      handleMouseLeave,
      onClickCell,
      onClickTimestamp,
      rowIndex,
      sortConfig,
      span,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    // Rows include the sortable header, the dataIndex does not
    const dataIndex = rowIndex - 1;

    const {getParamValue} = useUrlParams('n_detail_row', '');
    const isDetailsOpen = getParamValue() === String(dataIndex);

    const startMs = span.startTimestamp * 1000;
    const endMs = span.endTimestamp * 1000;
    const statusCode = span.data.statusCode;
    const size = span.data.size ?? span.data.responseBodySize;
    const method = span.data.method || 'GET';

    const spanTime = useMemo(
      () => relativeTimeInMs(span.startTimestamp * 1000, startTimestampMs),
      [span.startTimestamp, startTimestampMs]
    );
    const hasOccurred = currentTime >= spanTime;
    const isBeforeHover = currentHoverTime === undefined || currentHoverTime >= spanTime;

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
      isDetailsOpen,
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      onClick: () => onClickCell({dataIndex, rowIndex}),
      onMouseEnter: () => handleMouseEnter(span),
      onMouseLeave: () => handleMouseLeave(span),
      ref,
      style,
    } as CellProps;

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
          <Text>{method ? method : EMPTY_CELL}</Text>
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
          <StyledTimestampButton
            format="mm:ss.SSS"
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              onClickTimestamp(span);
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

const cellColor = p => {
  if (p.isDetailsOpen) {
    const colors = p.isStatusError
      ? [p.theme.alert.error.background]
      : [p.theme.background];
    return `color: ${colors[0]};`;
  }
  const colors = p.isStatusError
    ? [p.theme.alert.error.borderHover, p.theme.alert.error.iconColor]
    : ['inherit', p.theme.gray300];

  return `color: ${p.hasOccurred !== false ? colors[0] : colors[1]};`;
};

const Cell = styled('div')<CellProps>`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  cursor: ${p => (p.onClick ? 'pointer' : 'inherit')};

  ${cellBackground}
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
  padding: ${space(0.75)} ${space(1.5)};
`;

const StyledTimestampButton = styled(TimestampButton)`
  padding-inline: ${space(1.5)};
`;

export default NetworkTableCell;
