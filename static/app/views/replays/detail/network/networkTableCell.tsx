import type {ComponentProps, CSSProperties} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import FileSize from 'sentry/components/fileSize';
import {
  ButtonWrapper,
  Cell,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  getFrameMethod,
  getFrameStatus,
  getReqRespContentTypes,
  getResponseBodySize,
} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import {operationName} from 'sentry/views/replays/detail/utils';

const EMPTY_CELL = '--';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  columnIndex: number;
  frame: SpanFrame;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  rowIndex: number;
  startTimestampMs: number;
  style: CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

export default function NetworkTableCell({
  columnIndex,
  frame,
  onMouseEnter,
  onMouseLeave,
  onClickCell,
  onClickTimestamp,
  rowIndex,
  startTimestampMs,
  style,
  ref,
}: Props) {
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
  const columnProps = {
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
          delay={750}
          isHoverable
          maxWidth={10_000}
          showOnlyOnOverflow
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
