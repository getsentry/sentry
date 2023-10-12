import {ComponentProps, CSSProperties, forwardRef} from 'react';
import classNames from 'classnames';

import {
  ButtonWrapper,
  Cell,
  CodeHighlightCell,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire, IconInfo, IconWarning} from 'sentry/icons';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {HydratedA11yIssue} from 'sentry/utils/replays/hydrateA11yRecord';
import {Color} from 'sentry/utils/theme';
import useUrlParams from 'sentry/utils/useUrlParams';
import useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

const EMPTY_CELL = '--';

const IMPACT_ICON_MAPPING: Record<keyof HydratedA11yIssue['impact'], Color> = {
  minor: <IconInfo size="xs" />,
  moderate: <IconInfo size="xs" />,
  serious: <IconWarning size="xs" color="yellow400" />,
  critical: <IconFire size="xs" color="red400" />,
};

interface Props extends ReturnType<typeof useCrumbHandlers> {
  a11yIssue: HydratedA11yIssue;
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortAccessibility>['sortConfig'];
  startTimestampMs: number;
  style: CSSProperties;
}

const AccessibilityTableCell = forwardRef<HTMLDivElement, Props>(
  (
    {
      a11yIssue,
      columnIndex,
      currentHoverTime,
      currentTime,
      onClickCell,
      onClickTimestamp,
      onMouseEnter,
      onMouseLeave,
      rowIndex,
      sortConfig,
      startTimestampMs,
      style,
    }: Props,
    ref
  ) => {
    // Rows include the sortable header, the dataIndex does not
    const dataIndex = rowIndex - 1;

    const {getParamValue} = useUrlParams('a_detail_row', '');
    const isSelected = getParamValue() === String(dataIndex);

    const hasOccurred = currentTime >= a11yIssue.offsetMs;
    const isBeforeHover =
      currentHoverTime === undefined || currentHoverTime >= a11yIssue.offsetMs;

    const isByTimestamp = sortConfig.by === 'timestampMs';
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
      onClick: () => onClickCell({dataIndex, rowIndex}),
      onMouseEnter: () => onMouseEnter(a11yIssue),
      onMouseLeave: () => onMouseLeave(a11yIssue),
      ref,
      style,
    } as ComponentProps<typeof Cell>;

    const renderFns = [
      () => (
        <Cell {...columnProps}>
          <Text>
            {a11yIssue.impact ? (
              <Tooltip title={a11yIssue.impact ?? EMPTY_CELL}>
                {IMPACT_ICON_MAPPING[a11yIssue.impact]}
              </Tooltip>
            ) : (
              EMPTY_CELL
            )}
          </Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Text>{a11yIssue.id ?? EMPTY_CELL}</Text>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <CodeHighlightCell language="html" hideCopyButton>
            {a11yIssue.elements?.[0].element ?? EMPTY_CELL}
          </CodeHighlightCell>
        </Cell>
      ),
      () => (
        <Cell {...columnProps} numeric>
          <ButtonWrapper>
            <TimestampButton
              format="mm:ss.SSS"
              onClick={event => {
                event.stopPropagation();
                onClickTimestamp(a11yIssue);
              }}
              startTimestampMs={startTimestampMs}
              timestampMs={a11yIssue.timestampMs}
            />
          </ButtonWrapper>
        </Cell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

export default AccessibilityTableCell;
