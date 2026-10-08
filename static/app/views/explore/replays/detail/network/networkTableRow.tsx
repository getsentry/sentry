import type {Ref} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Text} from '@sentry/scraps/text';

import {FileSize} from 'sentry/components/fileSize';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {useCrumbHandlers} from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  getFrameMethod,
  getFrameStatus,
  getReqRespContentTypes,
  getResponseBodySize,
} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {TimelineRow} from 'sentry/views/explore/replays/detail/timelineRow';
import {TimestampButton} from 'sentry/views/explore/replays/detail/timestampButton';
import {operationName} from 'sentry/views/explore/replays/detail/utils';

const EMPTY_CELL = '--';

type RowHighlight = 'selected' | 'error' | 'warning';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  className: string;
  dataIndex: number;
  frame: SpanFrame;
  isSelected: boolean;
  onClickRow: (props: {dataIndex: number; rowIndex: number}) => void;
  startTimestampMs: number;
  ref?: Ref<HTMLTableRowElement>;
}

export function NetworkTableRow({
  className,
  dataIndex,
  frame,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClickRow,
  onClickTimestamp,
  startTimestampMs,
  ref,
}: Props) {
  const method = getFrameMethod(frame);
  const statusCode = getFrameStatus(frame);
  const isStatus400or500 = typeof statusCode === 'number' && statusCode >= 400;
  const contentTypeHeaders = getReqRespContentTypes(frame);
  const isContentTypeSane =
    contentTypeHeaders.req === undefined ||
    contentTypeHeaders.resp === undefined ||
    contentTypeHeaders.req === contentTypeHeaders.resp;
  const size = getResponseBodySize(frame);

  const highlight: RowHighlight | undefined = isSelected
    ? 'selected'
    : isStatus400or500
      ? 'error'
      : isContentTypeSane
        ? undefined
        : 'warning';

  return (
    <NetworkRow
      ref={ref}
      className={className}
      data-index={dataIndex}
      highlight={highlight}
      onClick={() => onClickRow({dataIndex, rowIndex: dataIndex + 1})}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
    >
      <SimpleTable.RowCell>
        <Text ellipsis variant="inherit">
          {method ? method : 'GET'}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text ellipsis variant="inherit">
          {typeof statusCode === 'number' ? statusCode : EMPTY_CELL}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <InfoText
          mode="overflowOnly"
          title={frame.description}
          delay={750}
          maxWidth={10_000}
          variant="inherit"
        >
          {frame.description || EMPTY_CELL}
        </InfoText>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <InfoText mode="overflowOnly" title={operationName(frame.op)} variant="inherit">
          {operationName(frame.op)}
        </InfoText>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Text align="right" ellipsis tabular variant="inherit">
          {size === undefined ? EMPTY_CELL : <FileSize base={10} bytes={size} />}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Text align="right" ellipsis tabular variant="inherit">
          {`${(frame.endTimestampMs - frame.timestampMs).toFixed(2)}ms`}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <TimestampButton
          precision="ms"
          onClick={event => {
            event.stopPropagation();
            onClickTimestamp(frame);
          }}
          startTimestampMs={startTimestampMs}
          timestampMs={frame.timestampMs}
        />
      </SimpleTable.RowCell>
    </NetworkRow>
  );
}

const NetworkRow = styled(TimelineRow, {
  shouldForwardProp: prop => prop !== 'highlight',
})<{highlight?: RowHighlight}>`
  cursor: pointer;

  ${p =>
    p.highlight === 'selected' &&
    css`
      background: ${p.theme.tokens.background.accent.vibrant};
      color: ${p.theme.tokens.content.onVibrant.light};
    `}

  ${p =>
    p.highlight === 'error' &&
    css`
      background: ${p.theme.tokens.background.transparent.danger.muted};
    `}

  ${p =>
    p.highlight === 'warning' &&
    css`
      background: ${p.theme.tokens.background.transparent.warning.muted};
    `}
`;
