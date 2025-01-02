import type {ComponentProps, CSSProperties} from 'react';
import {forwardRef} from 'react';
import classNames from 'classnames';

import FileSize from 'sentry/components/fileSize';
import {
  ButtonWrapper,
  Cell,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import {Tooltip} from 'sentry/components/tooltip';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  getFrameMethod,
  getFrameStatus,
  getReqRespContentTypes,
  getResponseBodySize,
} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import useUrlParams from 'sentry/utils/useUrlParams';
import type useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import {operationName} from 'sentry/views/replays/detail/utils';

const EMPTY_CELL = '--';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  frame: SpanFrame;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortNetwork>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
}

const NetworkTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      columnIndex,
      currentHoverTime,
      currentTime,
      frame,
      onMouseEnter,
      onMouseLeave,
      onClickCell,
      onClickTimestamp,
      rowIndex,
      sortConfig,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    // Rows include the sortable header, the dataIndex does not
    const dataIndex = rowIndex - 1;

    const {getParamValue} = useUrlParams('n_detail_row', '');
    const isSelected = getParamValue() === String(dataIndex);

    const method = getFrameMethod(frame);
    const statusCode = getFrameStatus(frame);
    const isStatus400or500 = typeof statusCode === 'number' && statusCode >= 400;
    const contentTypeHeaders = getReqRespContentTypes(frame);
    const isContentTypeSane =
      contentTypeHeaders.req === undefined ||
      contentTypeHeaders.resp === undefined ||
      contentTypeHeaders.req === contentTypeHeaders.resp;

    const size = getResponseBodySize(frame);

    const hasOccurred = currentTime >= frame.offsetMs;
    const isBeforeHover =
      currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

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
      isStatusError: isStatus400or500,
      isStatusWarning: !isContentTypeSane,
      onClick: () => onClickCell({dataIndex, rowIndex}),
      onMouseEnter: () => onMouseEnter(frame),
      onMouseLeave: () => onMouseLeave(frame),
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
            title={frame.description}
            isHoverable
            showOnlyOnOverflow
            overlayStyle={{maxWidth: '500px !important'}}
          >
            <Text>{frame.description || EMPTY_CELL}</Text>
          </Tooltip>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Tooltip title={operationName(frame.op)} isHoverable showOnlyOnOverflow>
            <Text>{operationName(frame.op)}</Text>
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
          <Text>{`${(frame.endTimestampMs - frame.timestampMs).toFixed(2)}ms`}</Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <ButtonWrapper>
            <TimestampButton
              precision="ms"
              onClick={event => {
                event.stopPropagation();
                onClickTimestamp(frame);
              }}
              startTimestampMs={startTimestampMs}
              timestampMs={frame.timestampMs}
            />
          </ButtonWrapper>
        </Cell>
      ),
    ];

    return renderFns[columnIndex]!();
  }
);

export default NetworkTableCell;
