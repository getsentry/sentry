import {Component, createRef, Fragment} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SectionHeading} from 'sentry/components/charts/styles';
import Input from 'sentry/components/input';
import {getOffsetOfElement} from 'sentry/components/performance/waterfall/utils';
import {IconAdd, IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  AGGREGATIONS,
  Column,
  generateFieldAsString,
  hasDuplicate,
  isLegalEquationColumn,
} from 'sentry/utils/discover/fields';
import theme from 'sentry/utils/theme';
import {getPointerPosition} from 'sentry/utils/touch';
import {setBodyUserSelect, UserSelectValues} from 'sentry/utils/userselect';
import {WidgetType} from 'sentry/views/dashboards/types';
import {FieldKey} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {SESSIONS_OPERATIONS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

import {generateFieldOptions} from '../utils';

import {FieldValueOption, QueryField} from './queryField';
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
  noFieldsMessage?: string;
  showAliasField?: boolean;
  source?: Sources;
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

const DRAG_CLASS = 'draggable-item';
const GHOST_PADDING = 4;
const MAX_COL_COUNT = 20;

enum PlaceholderPosition {
  TOP,
  BOTTOM,
}

class ColumnEditCollection extends Component<Props, State> {
  state: State = {
    isDragging: false,
    draggingIndex: void 0,
    draggingTargetIndex: void 0,
    draggingGrabbedOffset: void 0,
    error: new Map(),
    left: void 0,
    top: void 0,
  };

  componentDidMount() {
    if (!this.portal) {
      const portal = document.createElement('div');

      portal.style.position = 'absolute';
      portal.style.top = '0';
      portal.style.left = '0';
      portal.style.zIndex = String(theme.zIndex.modal);

      this.portal = portal;

      document.body.appendChild(this.portal);
    }
    this.checkColumnErrors(this.props.columns);
  }

  componentWillUnmount() {
    if (this.portal) {
      document.body.removeChild(this.portal);
    }
    this.cleanUpListeners();
  }

  checkColumnErrors(columns: Column[]) {
    const error = new Map();
    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];
      if (column.kind === 'equation') {
        const result = parseArithmetic(column.field);
        if (result.error) {
          error.set(i, result.error);
        }
      }
    }
    this.setState({error});
  }

  previousUserSelect: UserSelectValues | null = null;
  portal: HTMLElement | null = null;
  dragGhostRef = createRef<HTMLDivElement>();

  keyForColumn(column: Column, isGhost: boolean): string {
    if (column.kind === 'function') {
      return [...column.function, isGhost].join(':');
    }
    return [...column.field, isGhost].join(':');
  }

  cleanUpListeners() {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('touchmove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
      window.removeEventListener('touchend', this.onDragEnd);
    }
  }

  // Signal to the parent that a new column has been added.
  handleAddColumn = () => {
    const newColumn: Column = {kind: 'field', field: ''};
    this.props.onChange([...this.props.columns, newColumn]);
  };

  handleAddEquation = () => {
    const {organization} = this.props;
    const newColumn: Column = {kind: FieldValueKind.EQUATION, field: ''};
    trackAnalytics('discover_v2.add_equation', {organization});
    this.props.onChange([...this.props.columns, newColumn]);
  };

  handleUpdateColumn = (index: number, updatedColumn: Column) => {
    const newColumns = [...this.props.columns];

    if (updatedColumn.kind === 'equation') {
      this.setState(prevState => {
        const error = new Map(prevState.error);
        error.set(index, parseArithmetic(updatedColumn.field).error);
        return {
          ...prevState,
          error,
        };
      });
    } else {
      // Update any equations that contain the existing column
      this.updateEquationFields(newColumns, index, updatedColumn);
    }

    newColumns.splice(index, 1, updatedColumn);
    this.props.onChange(newColumns);
  };

  updateEquationFields = (newColumns: Column[], index: number, updatedColumn: Column) => {
    const oldColumn = newColumns[index];
    const existingColumn = generateFieldAsString(newColumns[index]);
    const updatedColumnString = generateFieldAsString(updatedColumn);
    if (!isLegalEquationColumn(updatedColumn) || hasDuplicate(newColumns, oldColumn)) {
      return;
    }
    // Find the equations in the list of columns
    for (let i = 0; i < newColumns.length; i++) {
      const newColumn = newColumns[i];

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
          alias: newColumns[i].alias,
        };
      }
    }
  };

  removeColumn(index: number) {
    const newColumns = [...this.props.columns];
    newColumns.splice(index, 1);
    this.checkColumnErrors(newColumns);
    this.props.onChange(newColumns);
  }

  startDrag(
    event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
    index: number
  ) {
    const isDragging = this.state.isDragging;
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
    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('touchmove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    window.addEventListener('touchend', this.onDragEnd);

    this.setState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      draggingGrabbedOffset,
      top,
      left,
    });
  }

  onDragMove = (event: MouseEvent | TouchEvent) => {
    const {isDragging, draggingTargetIndex, draggingGrabbedOffset} = this.state;

    if (!isDragging || !['mousemove', 'touchmove'].includes(event.type)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const pointerX = getPointerPosition(event, 'pageX');
    const pointerY = getPointerPosition(event, 'pageY');

    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    if (this.dragGhostRef.current) {
      // move the ghost box
      const ghostDOM = this.dragGhostRef.current;
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
    if (targetIndex >= 0 && targetIndex !== draggingTargetIndex) {
      this.setState({draggingTargetIndex: targetIndex});
    }
  };

  isFixedIssueColumn = (columnIndex: number) => {
    const {source, columns} = this.props;
    const column = columns[columnIndex];
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

  isRemainingReleaseHealthAggregate = (columnIndex: number) => {
    const {source, columns} = this.props;
    const column = columns[columnIndex];
    const aggregateCount = columns.filter(
      col => col.kind === FieldValueKind.FUNCTION
    ).length;
    return (
      aggregateCount <= 1 &&
      source === WidgetType.RELEASE &&
      column.kind === FieldValueKind.FUNCTION
    );
  };

  onDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!this.state.isDragging || !['mouseup', 'touchend'].includes(event.type)) {
      return;
    }

    const sourceIndex = this.state.draggingIndex;
    const targetIndex = this.state.draggingTargetIndex;
    if (typeof sourceIndex !== 'number' || typeof targetIndex !== 'number') {
      return;
    }

    // remove listeners that were attached in startColumnDrag
    this.cleanUpListeners();

    // restore body user-select values
    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

    // Reorder columns and trigger change.
    const newColumns = [...this.props.columns];
    const removed = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, removed[0]);
    this.checkColumnErrors(newColumns);
    this.props.onChange(newColumns);

    this.setState({
      isDragging: false,
      left: undefined,
      top: undefined,
      draggingIndex: undefined,
      draggingTargetIndex: undefined,
      draggingGrabbedOffset: undefined,
    });
  };

  renderGhost({gridColumns, singleColumn}: {gridColumns: number; singleColumn: boolean}) {
    const {isDragging, draggingIndex, draggingGrabbedOffset} = this.state;

    const index = draggingIndex;
    if (typeof index !== 'number' || !isDragging || !this.portal) {
      return null;
    }
    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    const top = Number(this.state.top) - dragOffsetY;
    const left = Number(this.state.left) - dragOffsetX;
    const col = this.props.columns[index];

    const style = {
      top: `${top}px`,
      left: `${left}px`,
    };
    const ghost = (
      <Ghost ref={this.dragGhostRef} style={style}>
        {this.renderItem(col, index, {
          singleColumn,
          isGhost: true,
          gridColumns,
        })}
      </Ghost>
    );

    return createPortal(ghost, this.portal);
  }

  renderItem(
    col: Column,
    i: number,
    {
      singleColumn = false,
      canDelete = true,
      canDrag = true,
      isGhost = false,
      gridColumns = 2,
      disabled = false,
    }: {
      gridColumns: number;
      singleColumn: boolean;
      canDelete?: boolean;
      canDrag?: boolean;
      disabled?: boolean;
      isGhost?: boolean;
    }
  ) {
    const {
      columns,
      fieldOptions,
      filterAggregateParameters,
      filterPrimaryOptions,
      noFieldsMessage,
      showAliasField,
    } = this.props;
    const {isDragging, draggingTargetIndex, draggingIndex} = this.state;

    let placeholder: React.ReactNode = null;
    // Add a placeholder above the target row.
    if (isDragging && isGhost === false && draggingTargetIndex === i) {
      placeholder = (
        <DragPlaceholder
          key={`placeholder:${this.keyForColumn(col, isGhost)}`}
          className={DRAG_CLASS}
        />
      );
    }

    // If the current row is the row in the drag ghost return the placeholder
    // or a hole if the placeholder is elsewhere.
    if (isDragging && isGhost === false && draggingIndex === i) {
      return placeholder;
    }

    const position =
      Number(draggingTargetIndex) <= Number(draggingIndex)
        ? PlaceholderPosition.TOP
        : PlaceholderPosition.BOTTOM;

    return (
      <Fragment key={`${i}:${this.keyForColumn(col, isGhost)}`}>
        {position === PlaceholderPosition.TOP && placeholder}
        <RowContainer
          showAliasField={showAliasField}
          singleColumn={singleColumn}
          className={isGhost ? '' : DRAG_CLASS}
        >
          {canDrag ? (
            <DragAndReorderButton
              aria-label={t('Drag to reorder')}
              onMouseDown={event => this.startDrag(event, i)}
              onTouchStart={event => this.startDrag(event, i)}
              icon={<IconGrabbable size="xs" />}
              size="zero"
              borderless
            />
          ) : singleColumn && showAliasField ? null : (
            <span />
          )}
          <QueryField
            fieldOptions={fieldOptions}
            gridColumns={gridColumns}
            fieldValue={col}
            onChange={value => this.handleUpdateColumn(i, value)}
            error={this.state.error.get(i)}
            takeFocus={i === this.props.columns.length - 1}
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
                  this.handleUpdateColumn(i, {
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
                title={t('Remove column')}
                onClick={() => this.removeColumn(i)}
                icon={<IconDelete />}
                borderless
              />
            ) : (
              <RemoveButton
                data-test-id={`remove-column-${i}`}
                aria-label={t('Remove column')}
                onClick={() => this.removeColumn(i)}
                icon={<IconDelete />}
                borderless
              />
            )
          ) : singleColumn && showAliasField ? null : (
            <span />
          )}
        </RowContainer>
        {position === PlaceholderPosition.BOTTOM && placeholder}
      </Fragment>
    );
  }

  render() {
    const {className, columns, showAliasField, source} = this.props;
    const canDelete = columns.filter(field => field.kind !== 'equation').length > 1;
    const canDrag = columns.length > 1;
    const canAdd = columns.length < MAX_COL_COUNT;
    const title = canAdd
      ? undefined
      : t(
          `Sorry, you've reached the maximum number of columns (%d). Delete columns to add more.`,
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
                AGGREGATIONS[col.function[0]] ?? SESSIONS_OPERATIONS[col.function[0]];
              if (!operation || !operation.parameters) {
                // Operation should be in the look-up table, but not all operations are (eg. private). This should be changed at some point.
                return 3;
              }
              return operation.parameters.length === 2 ? 3 : 2;
            })
          );

    // TODO(ddm): support multiple columns and equations, then remove this check
    const showActionButtons = source !== WidgetType.METRICS;

    return (
      <div className={className}>
        {this.renderGhost({gridColumns, singleColumn})}
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
          if (this.isFixedIssueColumn(i)) {
            return this.renderItem(col, i, {
              singleColumn,
              canDelete: false,
              canDrag,
              gridColumns,
              disabled: true,
            });
          }
          if (this.isRemainingReleaseHealthAggregate(i)) {
            return this.renderItem(col, i, {
              singleColumn,
              canDelete: false,
              canDrag,
              gridColumns,
            });
          }
          return this.renderItem(col, i, {
            singleColumn,
            canDelete,
            canDrag,
            gridColumns,
          });
        })}
        {showActionButtons && (
          <RowContainer showAliasField={showAliasField} singleColumn={singleColumn}>
            <Actions gap={1} showAliasField={showAliasField}>
              <Button
                size="sm"
                aria-label={t('Add a Column')}
                onClick={this.handleAddColumn}
                title={title}
                disabled={!canAdd}
                icon={<IconAdd isCircled />}
              >
                {t('Add a Column')}
              </Button>
              {source !== WidgetType.ISSUE && source !== WidgetType.RELEASE && (
                <Button
                  size="sm"
                  aria-label={t('Add an Equation')}
                  onClick={this.handleAddEquation}
                  title={title}
                  disabled={!canAdd}
                  icon={<IconAdd isCircled />}
                >
                  {t('Add an Equation')}
                </Button>
              )}
            </Actions>
          </RowContainer>
        )}
      </div>
    );
  }
}

const Actions = styled(ButtonBar)<{showAliasField?: boolean}>`
  grid-column: ${p => (p.showAliasField ? '1/-1' : ' 2/3')};
  justify-content: flex-start;
`;

const RowContainer = styled('div')<{
  singleColumn: boolean;
  showAliasField?: boolean;
}>`
  display: grid;
  grid-template-columns: ${space(3)} 1fr 40px;
  justify-content: center;
  align-items: center;
  width: 100%;
  touch-action: none;
  padding-bottom: ${space(1)};

  ${p =>
    p.showAliasField &&
    css`
      align-items: flex-start;
      grid-template-columns: ${p.singleColumn ? `1fr` : `${space(3)} 1fr 40px`};

      @media (min-width: ${p.theme.breakpoints.small}) {
        grid-template-columns: ${p.singleColumn
          ? `1fr calc(200px + ${space(1)})`
          : `${space(3)} 1fr calc(200px + ${space(1)}) 40px`};
      }
    `};
`;

const Ghost = styled('div')`
  background: ${p => p.theme.background};
  display: block;
  position: absolute;
  padding: ${GHOST_PADDING}px;
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  width: 710px;
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};

  & > ${RowContainer} {
    padding-bottom: 0;
  }

  & svg {
    cursor: grabbing;
  }
`;

const DragPlaceholder = styled('div')`
  margin: 0 ${space(3)} ${space(1)} ${space(3)};
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p.theme.form.md.height}px;
`;

const Heading = styled('div')<{gridColumns: number}>`
  grid-column: 2 / 3;

  /* Emulate the grid used in the column editor rows */
  display: grid;
  grid-template-columns: repeat(${p => p.gridColumns}, 1fr);
  grid-column-gap: ${space(1)};
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const AliasInput = styled(Input)`
  min-width: 50px;
`;

const AliasField = styled('div')<{singleColumn: boolean}>`
  margin-top: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    margin-top: 0;
    margin-left: ${space(1)};
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-row: 2/2;
    grid-column: ${p => (p.singleColumn ? '1/-1' : '2/2')};
  }
`;

const RemoveButton = styled(Button)`
  margin-left: ${space(1)};
  height: ${p => p.theme.form.md.height}px;
`;

const DragAndReorderButton = styled(Button)`
  height: ${p => p.theme.form.md.height}px;
`;

export default ColumnEditCollection;
