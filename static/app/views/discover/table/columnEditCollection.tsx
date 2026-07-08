import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Grid, type GridProps} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import {SectionHeading} from 'sentry/components/charts/styles';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {getOffsetOfElement} from 'sentry/components/performance/waterfall/utils';
import {IconAdd, IconDelete, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Column} from 'sentry/utils/discover/fields';
import {
  AGGREGATIONS,
  generateEquationFieldAsString,
  hasDuplicate,
  isLegalEquationColumn,
} from 'sentry/utils/discover/fields';
import {getPointerPosition} from 'sentry/utils/touch';
import type {UserSelectValues} from 'sentry/utils/userselect';
import {setBodyUserSelect} from 'sentry/utils/userselect';
import {WidgetType} from 'sentry/views/dashboards/types';
import {FieldKey} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {SESSIONS_OPERATIONS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import type {generateFieldOptions} from 'sentry/views/discover/utils';

import type {FieldValueOption} from './queryField';
import {QueryField} from './queryField';
import {FieldValueKind} from './types';

type Sources = WidgetType;

type Props = {
  // Input columns
  columns: Column[];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  // Fired when columns are added/removed/modified
  onChange: (columns: Column[]) => void;
  organization: Organization;
  className?: string;
  filterAggregateParameters?: (option: FieldValueOption) => boolean;
  filterPrimaryOptions?: (option: FieldValueOption) => boolean;
  isOnDemandWidget?: boolean;
  noFieldsMessage?: string;
  showAliasField?: boolean;
  source?: Sources;
  supportsEquations?: boolean;
};

type State = {
  draggingGrabbedOffset: undefined | {x: number; y: number};
  draggingIndex: undefined | number;
  draggingTargetIndex: undefined | number;
  error: Map<number, string | undefined>;
  isDragging: boolean;
  left: undefined | number;
  top: undefined | number;
};

type DragState = Omit<State, 'error'>;

const DRAG_CLASS = 'draggable-item';
const GHOST_PADDING = 4;
const MAX_COL_COUNT = 20;

enum PlaceholderPosition {
  TOP = 0,
  BOTTOM = 1,
}

function ColumnEditCollection({
  columns,
  fieldOptions,
  filterAggregateParameters,
  filterPrimaryOptions,
  noFieldsMessage,
  showAliasField,
  isOnDemandWidget,
  onChange,
  organization,
  source,
  className,
  supportsEquations,
}: Props) {
  const theme = useTheme();

  const [error, setError] = useState<State['error']>(() => new Map());
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggingIndex: undefined,
    draggingTargetIndex: undefined,
    draggingGrabbedOffset: undefined,
    left: undefined,
    top: undefined,
  });

  const portalRef = useRef<HTMLElement | null>(null);
  const previousUserSelectRef = useRef<UserSelectValues | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);

  // Hold the latest drag move/end logic so the window listeners always run
  // against current props/state without being re-attached on every render.
  const onDragMoveRef = useRef<(event: MouseEvent | TouchEvent) => void>(() => {});
  const onDragEndRef = useRef<(event: MouseEvent | TouchEvent) => void>(() => {});

  // Stable wrappers so addEventListener/removeEventListener match.
  const handleDragMove = useCallback((event: MouseEvent | TouchEvent) => {
    onDragMoveRef.current(event);
  }, []);
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent) => {
    onDragEndRef.current(event);
  }, []);

  const cleanUpListeners = useCallback(() => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('touchmove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchend', handleDragEnd);
  }, [handleDragMove, handleDragEnd]);

  const checkColumnErrors = useCallback((cols: Column[]) => {
    const newError = new Map();
    for (let i = 0; i < cols.length; i += 1) {
      const column = cols[i]!;
      if (column.kind === 'equation') {
        const result = parseArithmetic(column.field);
        if (result.error) {
          newError.set(i, result.error);
        }
      }
    }
    setError(newError);
  }, []);

  // Set up the drag ghost portal and run the initial error check on mount.
  useEffect(() => {
    if (!portalRef.current) {
      const portal = document.createElement('div');

      portal.style.position = 'absolute';
      portal.style.top = '0';
      portal.style.left = '0';
      portal.style.zIndex = String(theme.zIndex.modal);

      portalRef.current = portal;

      document.body.appendChild(portal);
    }
    checkColumnErrors(columns);

    return () => {
      if (portalRef.current) {
        document.body.removeChild(portalRef.current);
        portalRef.current = null;
      }
      cleanUpListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyForColumn = (column: Column, isGhost: boolean): string => {
    if (column.kind === 'function') {
      return [...column.function, isGhost].join(':');
    }
    return [...column.field, isGhost].join(':');
  };

  // Signal to the parent that a new column has been added.
  const handleAddColumn = () => {
    const newColumn: Column = {kind: 'field', field: ''};
    onChange([...columns, newColumn]);
  };

  const handleAddEquation = () => {
    const newColumn: Column = {kind: FieldValueKind.EQUATION, field: ''};
    trackAnalytics('discover_v2.add_equation', {organization});
    onChange([...columns, newColumn]);
  };

  const handleUpdateColumn = (index: number, updatedColumn: Column) => {
    const newColumns = [...columns];

    if (updatedColumn.kind === 'equation') {
      setError(prevError => {
        const newError = new Map(prevError);
        newError.set(index, parseArithmetic(updatedColumn.field).error);
        return newError;
      });
    } else {
      // Update any equations that contain the existing column
      updateEquationFields(newColumns, index, updatedColumn);
    }

    newColumns.splice(index, 1, updatedColumn);
    onChange(newColumns);
  };

  const updateEquationFields = (
    newColumns: Column[],
    index: number,
    updatedColumn: Column
  ) => {
    const oldColumn = newColumns[index]!;
    const existingColumn = generateEquationFieldAsString(newColumns[index]!);
    const updatedColumnString = generateEquationFieldAsString(updatedColumn);
    if (!isLegalEquationColumn(updatedColumn) || hasDuplicate(newColumns, oldColumn)) {
      return;
    }
    // Find the equations in the list of columns
    for (let i = 0; i < newColumns.length; i++) {
      const newColumn = newColumns[i]!;

      if (newColumn.kind === 'equation') {
        const result = parseArithmetic(newColumn.field);
        let newEquation = '';
        // Track where to continue from, not reconstructing from result so we don't have to worry
        // about spacing
        let lastIndex = 0;

        // the parser separates fields & functions, so we only need to check one
        const fields =
          oldColumn.kind === 'function' ? result.tc.functions : result.tc.fields;

        // for each field, add the text before it, then the new function and update index
        // to be where we want to start again
        for (const field of fields) {
          if (field.term === existingColumn && lastIndex !== field.location.end.offset) {
            newEquation +=
              newColumn.field.substring(lastIndex, field.location.start.offset) +
              updatedColumnString;
            lastIndex = field.location.end.offset;
          }
        }

        // Add whatever remains to be added from the equation, if existing field wasn't found
        // add the entire equation
        newEquation += newColumn.field.substring(lastIndex);
        newColumns[i] = {
          kind: 'equation',
          field: newEquation,
          alias: newColumns[i]!.alias,
        };
      }
    }
  };

  const removeColumn = (index: number) => {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    checkColumnErrors(newColumns);
    onChange(newColumns);
  };

  const startDrag = (
    event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
    index: number
  ) => {
    const isDragging = dragState.isDragging;
    if (isDragging || !['mousedown', 'touchstart'].includes(event.type)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const top = getPointerPosition(event, 'pageY');
    const left = getPointerPosition(event, 'pageX');

    // Compute where the user clicked on the drag handle. Avoids the element
    // jumping from the cursor on mousedown.
    const draggingElement = Array.from(document.querySelectorAll(`.${DRAG_CLASS}`)).find(
      n => n.contains(event.currentTarget)
    )!;
    const {x, y} = getOffsetOfElement(draggingElement);

    const draggingGrabbedOffset = {
      x: left - x + GHOST_PADDING,
      y: top - y + GHOST_PADDING,
    };

    // prevent the user from selecting things when dragging a column.
    previousUserSelectRef.current = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);

    setDragState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      draggingGrabbedOffset,
      top,
      left,
    });
  };

  const onDragMove = (event: MouseEvent | TouchEvent) => {
    const {isDragging, draggingTargetIndex, draggingGrabbedOffset} = dragState;

    if (!isDragging || !['mousemove', 'touchmove'].includes(event.type)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const pointerX = getPointerPosition(event, 'pageX');
    const pointerY = getPointerPosition(event, 'pageY');

    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    if (dragGhostRef.current) {
      // move the ghost box
      const ghostDOM = dragGhostRef.current;
      // Adjust so cursor is over the grab handle.
      ghostDOM.style.left = `${pointerX - dragOffsetX}px`;
      ghostDOM.style.top = `${pointerY - dragOffsetY}px`;
    }

    const dragItems = document.querySelectorAll(`.${DRAG_CLASS}`);
    // Find the item that the ghost is currently over.
    const targetIndex = Array.from(dragItems).findIndex(dragItem => {
      const rects = dragItem.getBoundingClientRect();
      const top = pointerY;

      const thresholdStart = window.scrollY + rects.top;
      const thresholdEnd = window.scrollY + rects.top + rects.height;

      return top >= thresholdStart && top <= thresholdEnd;
    });

    // Issue column in Issue widgets are fixed (cannot be moved or deleted)
    if (
      targetIndex >= 0 &&
      targetIndex !== draggingTargetIndex &&
      !isFixedMetricsColumn(targetIndex)
    ) {
      setDragState(prev => ({...prev, draggingTargetIndex: targetIndex}));
    }
  };
  onDragMoveRef.current = onDragMove;

  const isFixedIssueColumn = (columnIndex: number) => {
    const column = columns[columnIndex]!;
    const issueFieldColumnCount = columns.filter(
      col => col.kind === 'field' && col.field === FieldKey.ISSUE
    ).length;
    return (
      issueFieldColumnCount <= 1 &&
      source === WidgetType.ISSUE &&
      column.kind === 'field' &&
      column.field === FieldKey.ISSUE
    );
  };

  const isFixedMetricsColumn = (columnIndex: number) => {
    return source === WidgetType.METRICS && columnIndex === 0;
  };

  const isRemainingReleaseHealthAggregate = (columnIndex: number) => {
    const column = columns[columnIndex]!;
    const aggregateCount = columns.filter(
      col => col.kind === FieldValueKind.FUNCTION
    ).length;
    return (
      aggregateCount <= 1 &&
      source === WidgetType.RELEASE &&
      column.kind === FieldValueKind.FUNCTION
    );
  };

  const onDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!dragState.isDragging || !['mouseup', 'touchend'].includes(event.type)) {
      return;
    }

    const sourceIndex = dragState.draggingIndex;
    const targetIndex = dragState.draggingTargetIndex;
    if (typeof sourceIndex !== 'number' || typeof targetIndex !== 'number') {
      return;
    }

    // remove listeners that were attached in startColumnDrag
    cleanUpListeners();

    // restore body user-select values
    if (previousUserSelectRef.current) {
      setBodyUserSelect(previousUserSelectRef.current);
      previousUserSelectRef.current = null;
    }

    // Reorder columns and trigger change.
    const newColumns = [...columns];
    const removed = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, removed[0]!);
    checkColumnErrors(newColumns);
    onChange(newColumns);

    setDragState({
      isDragging: false,
      left: undefined,
      top: undefined,
      draggingIndex: undefined,
      draggingTargetIndex: undefined,
      draggingGrabbedOffset: undefined,
    });
  };
  onDragEndRef.current = onDragEnd;

  const renderGhost = ({
    gridColumns,
    singleColumn,
  }: {
    gridColumns: number;
    singleColumn: boolean;
  }) => {
    const {isDragging, draggingIndex, draggingGrabbedOffset} = dragState;

    const index = draggingIndex;
    if (typeof index !== 'number' || !isDragging || !portalRef.current) {
      return null;
    }
    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    const top = Number(dragState.top) - dragOffsetY;
    const left = Number(dragState.left) - dragOffsetX;
    const col = columns[index]!;

    const style = {
      top: `${top}px`,
      left: `${left}px`,
    };
    const ghost = (
      <Ghost ref={dragGhostRef} style={style}>
        {renderItem(col, index, {
          singleColumn,
          isGhost: true,
          gridColumns,
        })}
      </Ghost>
    );

    return createPortal(ghost, portalRef.current);
  };

  const renderItem = (
    col: Column,
    i: number,
    {
      singleColumn,
      canDelete = true,
      canDrag = true,
      isGhost = false,
      gridColumns,
      disabled = false,
    }: {
      gridColumns: number;
      singleColumn: boolean;
      canDelete?: boolean;
      canDrag?: boolean;
      disabled?: boolean;
      isGhost?: boolean;
    }
  ) => {
    const {isDragging, draggingTargetIndex, draggingIndex} = dragState;

    let placeholder: React.ReactNode = null;
    // Add a placeholder above the target row.
    if (isDragging && !isGhost && draggingTargetIndex === i) {
      placeholder = (
        <DragPlaceholder
          key={`placeholder:${keyForColumn(col, isGhost)}`}
          className={DRAG_CLASS}
        />
      );
    }

    // If the current row is the row in the drag ghost return the placeholder
    // or a hole if the placeholder is elsewhere.
    if (isDragging && !isGhost && draggingIndex === i) {
      return placeholder;
    }

    const position =
      Number(draggingTargetIndex) <= Number(draggingIndex)
        ? PlaceholderPosition.TOP
        : PlaceholderPosition.BOTTOM;

    return (
      <Fragment key={`${i}:${keyForColumn(col, isGhost)}`}>
        {position === PlaceholderPosition.TOP && placeholder}
        <RowContainer
          showAliasField={showAliasField}
          singleColumn={singleColumn}
          className={isGhost ? '' : DRAG_CLASS}
        >
          {canDrag ? (
            <StyledDragReorderButton
              onMouseDown={event => startDrag(event, i)}
              onTouchStart={event => startDrag(event, i)}
            />
          ) : singleColumn && showAliasField ? null : (
            <span />
          )}
          <QueryField
            fieldOptions={fieldOptions}
            gridColumns={gridColumns}
            fieldValue={col}
            onChange={value => handleUpdateColumn(i, value)}
            error={error.get(i)}
            takeFocus={i === columns.length - 1}
            otherColumns={columns}
            shouldRenderTag
            disabled={disabled}
            filterPrimaryOptions={filterPrimaryOptions}
            filterAggregateParameters={filterAggregateParameters}
            noFieldsMessage={noFieldsMessage}
            skipParameterPlaceholder={showAliasField}
          />
          {showAliasField && (
            <AliasField singleColumn={singleColumn}>
              <AliasInput
                name="alias"
                placeholder={t('Alias')}
                value={col.alias ?? ''}
                onChange={value => {
                  handleUpdateColumn(i, {
                    ...col,
                    alias: value.target.value,
                  });
                }}
              />
            </AliasField>
          )}
          {canDelete || col.kind === 'equation' ? (
            showAliasField ? (
              <RemoveButton
                data-test-id={`remove-column-${i}`}
                aria-label={t('Remove column')}
                tooltipProps={{title: t('Remove column')}}
                onClick={() => removeColumn(i)}
                icon={<IconDelete />}
                variant="transparent"
              />
            ) : (
              <RemoveButton
                data-test-id={`remove-column-${i}`}
                aria-label={t('Remove column')}
                onClick={() => removeColumn(i)}
                icon={<IconDelete />}
                variant="transparent"
              />
            )
          ) : singleColumn && showAliasField ? null : (
            <span />
          )}

          {isOnDemandWidget && col.kind === 'equation' ? (
            <OnDemandEquationsWarning />
          ) : null}
        </RowContainer>
        {position === PlaceholderPosition.BOTTOM && placeholder}
      </Fragment>
    );
  };

  const canDelete = columns.filter(field => field.kind !== 'equation').length > 1;
  const canDrag = columns.length > 1;
  const canAdd = columns.length < MAX_COL_COUNT;
  const title = canAdd
    ? undefined
    : t(
        "Sorry, you've reached the maximum number of columns (%d). Delete columns to add more.",
        MAX_COL_COUNT
      );

  const singleColumn = columns.length === 1;

  // Get the longest number of columns so we can layout the rows.
  // We always want at least 2 columns.
  const gridColumns =
    source === WidgetType.ISSUE
      ? 1
      : Math.max(
          ...columns.map(col => {
            if (col.kind !== 'function') {
              return 2;
            }
            const operation =
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              AGGREGATIONS[col.function[0]] ?? SESSIONS_OPERATIONS[col.function[0]];
            if (!operation?.parameters) {
              // Operation should be in the look-up table, but not all operations are (eg. private). This should be changed at some point.
              return 3;
            }
            return operation.parameters.length === 2 ? 3 : 2;
          })
        );

  return (
    <div className={className}>
      {renderGhost({gridColumns, singleColumn})}
      {!showAliasField && source !== WidgetType.ISSUE && (
        <RowContainer showAliasField={showAliasField} singleColumn={singleColumn}>
          <Heading gridColumns={gridColumns}>
            <StyledSectionHeading>{t('Tag / Field / Function')}</StyledSectionHeading>
            <StyledSectionHeading>{t('Field Parameter')}</StyledSectionHeading>
          </Heading>
        </RowContainer>
      )}
      {columns.map((col: Column, i: number) => {
        // Issue column in Issue widgets are fixed (cannot be changed or deleted)
        if (isFixedIssueColumn(i)) {
          return renderItem(col, i, {
            singleColumn,
            canDelete: false,
            canDrag,
            gridColumns,
            disabled: true,
          });
        }
        if (isRemainingReleaseHealthAggregate(i)) {
          return renderItem(col, i, {
            singleColumn,
            canDelete: false,
            canDrag,
            gridColumns,
          });
        }
        if (isFixedMetricsColumn(i)) {
          return renderItem(col, i, {
            singleColumn,
            canDelete: false,
            canDrag: false,
            gridColumns,
          });
        }
        return renderItem(col, i, {
          singleColumn,
          canDelete,
          canDrag,
          gridColumns,
        });
      })}
      <RowContainer showAliasField={showAliasField} singleColumn={singleColumn}>
        <Actions showAliasField={showAliasField}>
          <Button
            size="sm"
            aria-label={t('Add a Column')}
            onClick={handleAddColumn}
            tooltipProps={{title}}
            disabled={!canAdd}
            icon={<IconAdd />}
          >
            {t('Add a Column')}
          </Button>
          {supportsEquations && (
            <Button
              size="sm"
              aria-label={t('Add an Equation')}
              onClick={handleAddEquation}
              tooltipProps={{title}}
              disabled={!canAdd}
              icon={<IconAdd />}
            >
              {t('Add an Equation')}
            </Button>
          )}
        </Actions>
      </RowContainer>
    </div>
  );
}

function OnDemandEquationsWarning() {
  return (
    <OnDemandContainer>
      <Tooltip
        containerDisplayMode="inline-flex"
        title={t(
          "This is using indexed data because we don't routinely collect metrics for equations."
        )}
      >
        <IconWarning variant="warning" />
      </Tooltip>
    </OnDemandContainer>
  );
}

const Actions = styled((props: GridProps & {showAliasField?: boolean}) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))<{showAliasField?: boolean}>`
  grid-column: ${p => (p.showAliasField ? '1/-1' : ' 2/3')};
  justify-content: flex-start;
`;

const RowContainer = styled('div')<{
  singleColumn: boolean;
  showAliasField?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p => p.theme.space['2xl']} 1fr 40px 40px;
  justify-content: center;
  align-items: center;
  width: 100%;
  touch-action: none;
  padding-bottom: ${p => p.theme.space.md};

  ${p =>
    p.showAliasField &&
    css`
      align-items: flex-start;
      grid-template-columns: ${p.singleColumn
        ? '1fr'
        : `${p.theme.space['2xl']} 1fr 40px 40px`};

      @media (min-width: ${p.theme.breakpoints.sm}) {
        grid-template-columns: ${p.singleColumn
          ? `1fr calc(200px + ${p.theme.space.md})`
          : `${p.theme.space['2xl']} 1fr calc(200px + ${p.theme.space.md}) 40px 40px`};
      }
    `}
`;

const Ghost = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  display: block;
  position: absolute;
  padding: ${GHOST_PADDING}px;
  border-radius: ${p => p.theme.radius.md};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  width: 710px;
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${p => p.theme.space.xl};

  & > ${RowContainer} {
    padding-bottom: 0;
  }

  & svg {
    cursor: grabbing;
  }
`;

const OnDemandContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const DragPlaceholder = styled('div')`
  margin: 0 ${p => p.theme.space['2xl']} ${p => p.theme.space.md}
    ${p => p.theme.space['2xl']};
  border: 2px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  height: ${p => p.theme.form.md.height};
`;

const Heading = styled('div')<{gridColumns: number}>`
  grid-column: 2 / 3;

  /* Emulate the grid used in the column editor rows */
  display: grid;
  grid-template-columns: repeat(${p => p.gridColumns}, 1fr);
  grid-column-gap: ${p => p.theme.space.md};
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const AliasInput = styled(Input)`
  min-width: 50px;
`;

const AliasField = styled('div')<{singleColumn: boolean}>`
  margin-top: ${p => p.theme.space.md};
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    margin-top: 0;
    margin-left: ${p => p.theme.space.md};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-row: 2/2;
    grid-column: ${p => (p.singleColumn ? '1/-1' : '2/2')};
  }
`;

const RemoveButton = styled(Button)`
  margin-left: ${p => p.theme.space.md};
  height: ${p => p.theme.form.md.height};
`;

const StyledDragReorderButton = styled(DragReorderButton)`
  height: ${p => p.theme.form.md.height};
`;

export {ColumnEditCollection};
