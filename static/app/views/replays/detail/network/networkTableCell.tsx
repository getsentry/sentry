import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  columnIndex: number;
  handleClick: (span: NetworkSpan) => void;
  handleMouseEnter: (span: NetworkSpan) => void;
  handleMouseLeave: (span: NetworkSpan) => void;
  hasOccurred: undefined | boolean;
  hasOccurredDesc: boolean;
  isCurrent: boolean;
  isHovered: boolean;
  span: NetworkSpan;
  startTimestampMs: number;
  style?: CSSProperties;
};

function NetworkTableCell({
  columnIndex,
  handleClick,
  handleMouseEnter,
  handleMouseLeave,
  hasOccurred,
  hasOccurredDesc,
  isCurrent,
  isHovered,
  span,
  startTimestampMs,
  style,
}: Props) {
  const startMs = span.startTimestamp * 1000;
  const endMs = span.endTimestamp * 1000;
  const statusCode = span.data.statusCode;

  const columnProps = {
    onMouseEnter: () => handleMouseEnter(span),
    onMouseLeave: () => handleMouseLeave(span),
    hasOccurred,
    hasOccurredDesc,
    isCurrent,
    isHovered,
    isStatusError: typeof statusCode === 'number' && statusCode >= 400,
    style,
  };

  const renderFns = [
    () => (
      <Cell {...columnProps}>
        <Text>{statusCode ? statusCode : null}</Text>
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
          <Text>{span.description}</Text>
        </Tooltip>
      </Cell>
    ),
    () => (
      <Cell {...columnProps}>
        <Tooltip title={span.op.replace('resource.', '')} isHoverable showOnlyOnOverflow>
          <Text>{span.op.replace('resource.', '')}</Text>
        </Tooltip>
      </Cell>
    ),
    () => (
      <Cell {...columnProps} numeric>
        <Text>
          {span.data.size === undefined ? null : <FileSize bytes={span.data.size} />}
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
          onClick={() => handleClick(span)}
          startTimestampMs={startTimestampMs}
          timestampMs={startMs}
        />
      </Cell>
    ),
  ];

  return renderFns[columnIndex]();
}

const Text = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const Cell = styled('div')<{
  hasOccurred: undefined | boolean;
  hasOccurredDesc: boolean;
  isCurrent: boolean;
  isHovered: boolean;
  isStatusError: boolean;
  numeric?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} ${space(1.5)};

  font-size: ${p => p.theme.fontSizeSmall};

  background-color: ${p =>
    p.isStatusError ? p.theme.alert.error.backgroundLight : 'inherit'};

  ${p => (p.hasOccurredDesc ? 'border-top' : 'border-bottom')}: 1px solid
    ${p =>
    p.isCurrent ? p.theme.purple300 : p.isHovered ? p.theme.purple200 : 'transparent'};

  color: ${p =>
    p.isStatusError
      ? p.hasOccurred
        ? p.theme.alert.error.iconColor
        : p.theme.alert.error.borderHover
      : p.hasOccurred
      ? 'inherit'
      : p.theme.gray300};

  ${p =>
    p.numeric &&
    `
    font-variant-numeric: tabular-nums;
    justify-content: flex-end;
  `};
`;

export default NetworkTableCell;
