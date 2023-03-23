import {CSSProperties, forwardRef} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
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
    const dataIndex = rowIndex - 1;

    const organization = useOrganization();
    const {currentTime} = useReplayContext();
    const {setParamValue} = useUrlParams('n_detail_row', '');

    const hassNetworkDetails = organization.features.includes(
      'session-replay-network-details'
    );

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
      isHovered,
      isStatusError: typeof statusCode === 'number' && statusCode >= 400,
      onClick: hassNetworkDetails ? () => setParamValue(String(dataIndex)) : undefined,
      onMouseEnter: () => handleMouseEnter(span),
      onMouseLeave: () => handleMouseLeave(span),
      ref,
      style,
    };
    const size = span.data.size ?? span.data.responseBodySize;

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
          <Tooltip
            title={span.op.replace('resource.', '')}
            isHoverable
            showOnlyOnOverflow
          >
            <Text>{span.op.replace('resource.', '')}</Text>
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
            onClick={() => handleClick(span)}
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
  if (p.hasOccurred === undefined && !p.isStatusError) {
    return `background-color: ${p.isHovered ? p.theme.hover : 'inherit'};`;
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
  const colors = p.isStatusError
    ? [p.theme.alert.error.borderHover, p.theme.alert.error.iconColor]
    : ['inherit', p.theme.gray300];
  if (p.hasOccurred === undefined) {
    return `color: ${colors[0]};`;
  }
  return `color: ${p.hasOccurred ? colors[0] : colors[1]};`;
};

const Cell = styled('div')<{
  hasOccurred: boolean | undefined;
  hasOccurredAsc: boolean | undefined;
  isCurrent: boolean;
  isHovered: boolean;
  isStatusError: boolean;
  numeric?: boolean;
  onClick?: any;
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
