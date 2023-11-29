import {ComponentProps, CSSProperties, forwardRef} from 'react';
import classNames from 'classnames';

import {Button} from 'sentry/components/button';
import {
  Cell,
  CodeHighlightCell,
  Text,
} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire, IconInfo, IconPlay, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import {Color} from 'sentry/utils/theme';
import useUrlParams from 'sentry/utils/useUrlParams';
import useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';

const EMPTY_CELL = '--';

const IMPACT_ICON_MAPPING: Record<keyof HydratedA11yFrame['impact'], Color> = {
  minor: <IconInfo size="xs" />,
  moderate: <IconInfo size="xs" />,
  serious: <IconWarning size="xs" color="yellow400" />,
  critical: <IconFire size="xs" color="red400" />,
};

interface Props extends ReturnType<typeof useCrumbHandlers> {
  a11yIssue: HydratedA11yFrame;
  columnIndex: number;
  currentHoverTime: number | undefined;
  currentTime: number;
  onClickCell: (props: {dataIndex: number; rowIndex: number}) => void;
  rowIndex: number;
  sortConfig: ReturnType<typeof useSortAccessibility>['sortConfig'];
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
          <CodeHighlightCell language="html" hideCopyButton data-render-inline>
            {a11yIssue.element.element ?? EMPTY_CELL}
          </CodeHighlightCell>
        </Cell>
      ),
      () => (
        <Cell {...columnProps}>
          <Button
            size="xs"
            borderless
            aria-label={t('See in replay')}
            icon={<IconPlay size="xs" color={isSelected ? 'white' : 'black'} />}
            onClick={e => {
              e.stopPropagation();
              onClickTimestamp(a11yIssue);
            }}
          />
        </Cell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

export default AccessibilityTableCell;
