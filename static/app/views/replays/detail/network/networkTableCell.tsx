import {ComponentProps, CSSProperties, forwardRef, MouseEvent, useMemo} from 'react';
import classNames from 'classnames';

import FileSize from 'sentry/components/fileSize';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {
  Cell,
  StyledTimestampButton,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import {Tooltip} from 'sentry/components/tooltip';
import useUrlParams from 'sentry/utils/useUrlParams';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import {operationName} from 'sentry/views/replays/detail/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

const EMPTY_CELL = '--';

type Props = {
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  onClickTimestamp: (crumb: NetworkSpan) => void;
  onMouseEnter: (span: NetworkSpan) => void;
  onMouseLeave: (span: NetworkSpan) => void;
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
      currentHoverTime,
      currentTime,
      onMouseEnter,
      onMouseLeave,
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
    const isSelected = getParamValue() === String(dataIndex);

    const startMs = span.startTimestamp * 1000;
    const endMs = span.endTimestamp * 1000;
    const method = span.data.method;
    const statusCode = span.data.statusCode;
    // `data.responseBodySize` is from SDK version 7.44-7.45
    const size = span.data.size ?? span.data.response?.size ?? span.data.responseBodySize;

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
      isSelected,
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      onClick: () => onClickCell({dataIndex, rowIndex}),
      onMouseEnter: () => onMouseEnter(span),
      onMouseLeave: () => onMouseLeave(span),
      ref,
      style,
    } as ComponentProps<typeof Cell>;

    const renderFns = [
      () => (
        <Cell {...columnProps}>
          <Text>{method ? method : 'GET'}</Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>{typeof statusCode === 'number' ? statusCode : EMPTY_CELL}</Text>
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

    return renderFns[columnIndex]!();
  }
);

export default NetworkTableCell;
