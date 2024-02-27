import type {ComponentProps, CSSProperties, ReactNode} from 'react';
import {forwardRef} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Cell, Text} from 'sentry/components/replays/virtualizedGrid/bodyCell';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire, IconInfo, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import useUrlParams from 'sentry/utils/useUrlParams';
import type useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';

const EMPTY_CELL = '--';

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

    const IMPACT_ICON_MAPPING: Record<keyof HydratedA11yFrame['impact'], ReactNode> = {
      minor: <IconInfo size="xs" />,
      moderate: <IconInfo size="xs" />,
      serious: <IconWarning size="xs" color={isSelected ? 'white' : 'yellow400'} />,
      critical: <IconFire size="xs" color={isSelected ? 'white' : 'red400'} />,
    };

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
        <StyledCell {...columnProps} impact={a11yIssue.impact} isRowSelected={isSelected}>
          <Text>
            {a11yIssue.impact ? (
              <Tooltip title={a11yIssue.impact ?? EMPTY_CELL}>
                {IMPACT_ICON_MAPPING[a11yIssue.impact]}
              </Tooltip>
            ) : (
              EMPTY_CELL
            )}
          </Text>
        </StyledCell>
      ),
      () => (
        <StyledCell {...columnProps} impact={a11yIssue.impact} isRowSelected={isSelected}>
          <Text>{a11yIssue.id ?? EMPTY_CELL}</Text>
        </StyledCell>
      ),
      () => (
        <StyledCell {...columnProps} impact={a11yIssue.impact} isRowSelected={isSelected}>
          <Tooltip
            title={a11yIssue.element.element ?? EMPTY_CELL}
            isHoverable
            showOnlyOnOverflow
            overlayStyle={{maxWidth: '500px !important'}}
          >
            <StyledTextOverflow>
              {a11yIssue.element.element ?? EMPTY_CELL}
            </StyledTextOverflow>
          </Tooltip>
        </StyledCell>
      ),
    ];

    return renderFns[columnIndex]();
  }
);

export default AccessibilityTableCell;

const StyledTextOverflow = styled(TextOverflow)`
  padding-right: ${space(1)};
`;

const StyledCell = styled(Cell)<{
  impact: HydratedA11yFrame['impact'];
  isRowSelected: boolean;
}>`
  background: ${p =>
    p.isSelected
      ? p.theme.purple300
      : p.impact === 'serious'
        ? p.theme.yellow100
        : p.impact === 'critical'
          ? p.theme.red100
          : 'transparent'};
`;
