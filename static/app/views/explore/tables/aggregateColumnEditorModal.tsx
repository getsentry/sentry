import {Fragment, useCallback, useMemo, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {
  SelectKey,
  SelectOption,
  SelectSection,
} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {isParsedFunction, parseFunction} from 'sentry/utils/discover/fields';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {
  AggregateField,
  BaseAggregateField,
  GroupBy,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {
  updateVisualizeAggregate,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';

const GROUP_BY_PREFIX = 'groupby:';
const FUNCTION_PREFIX = 'function:';

interface AggregateColumnEditorModalProps extends ModalRenderProps {
  columns: AggregateField[];
  numberTags: TagCollection;
  onColumnsChange: (columns: BaseAggregateField[]) => void;
  stringTags: TagCollection;
}

export function AggregateColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  numberTags,
  stringTags,
}: AggregateColumnEditorModalProps) {
  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState<AggregateField[]>(columns);

  const groupBys = useMemo(() => {
    return columns.filter(isGroupBy).map(groupBy => groupBy.groupBy);
  }, [columns]);

  const yAxes = useMemo(() => {
    return columns.filter(isVisualize).flatMap(visualize => visualize.yAxes);
  }, [columns]);

  const handleApply = useCallback(() => {
    onColumnsChange(tempColumns);
    closeModal();
  }, [closeModal, onColumnsChange, tempColumns]);

  return (
    <DragNDropContext
      columns={tempColumns}
      setColumns={setTempColumns}
      defaultColumn={() => ({groupBy: ''})}
    >
      {({insertColumn, updateColumnAtIndex, deleteColumnAtIndex, editableColumns}) => (
        <Fragment>
          <Header closeButton data-test-id="editor-header">
            <h4>{t('Edit Table')}</h4>
          </Header>
          <Body data-test-id="editor-body">
            {editableColumns.map((column, i) => {
              return (
                <ColumnEditorRow
                  key={column.id}
                  canDelete={editableColumns.length > 1}
                  column={column}
                  options={[]}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                  numberTags={numberTags}
                  stringTags={stringTags}
                  groupBys={groupBys}
                  yAxes={yAxes}
                />
              );
            })}
            <RowContainer>
              <ButtonBar gap={1}>
                <Button
                  size="sm"
                  aria-label={t('Add a Column')}
                  onClick={insertColumn}
                  icon={<IconAdd isCircled />}
                >
                  {t('Add a Column')}
                </Button>
              </ButtonBar>
            </RowContainer>
          </Body>
          <Footer data-test-id="editor-footer">
            <ButtonBar gap={1}>
              <LinkButton priority="default" href={SPAN_PROPS_DOCS_URL} external>
                {t('Read the Docs')}
              </LinkButton>
              <Button aria-label={t('Apply')} priority="primary" onClick={handleApply}>
                {t('Apply')}
              </Button>
            </ButtonBar>
          </Footer>
        </Fragment>
      )}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column<AggregateField>;
  groupBys: string[];
  numberTags: TagCollection;
  onColumnChange: (column: AggregateField) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  stringTags: TagCollection;
  yAxes: string[];
}

function ColumnEditorRow({
  canDelete,
  column,
  groupBys,
  onColumnChange,
  onColumnDelete,
  numberTags,
  stringTags,
  yAxes,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  const parsedField = useMemo(() => {
    if (!defined(column.column)) {
      return null;
    }
    if (isGroupBy(column.column)) {
      return column.column;
    }
    return parseFunction(column.column.yAxes[0]!);
  }, [column.column]);

  return (
    <RowContainer
      key={column.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      <StyledButton
        aria-label={t('Drag to reorder')}
        borderless
        size="sm"
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      <FunctionOrGroupBySelector
        field={column.column}
        parsedField={parsedField}
        tags={stringTags}
        groupBys={groupBys}
        onChange={onColumnChange}
      />
      {isVisualize(column.column) && isParsedFunction(parsedField) && (
        <ArgumentSelector
          field={column.column}
          parsedFunction={parsedField}
          numberTags={numberTags}
          stringTags={stringTags}
          onChange={onColumnChange}
          yAxes={yAxes}
        />
      )}
      <StyledButton
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={onColumnDelete}
      />
    </RowContainer>
  );
}

interface FunctionOrGroupBySelectorProps {
  field: AggregateField | undefined;
  groupBys: string[];
  onChange: (column: AggregateField) => void;
  parsedField: GroupBy | ParsedFunction | null;
  tags: TagCollection;
}

function FunctionOrGroupBySelector({
  field,
  parsedField,
  groupBys,
  tags,
  onChange,
}: FunctionOrGroupBySelectorProps) {
  const functionOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: `${FUNCTION_PREFIX}${aggregate}`,
        textValue: aggregate,
      };
    });
  }, []);

  const rawGroupByOptions: Array<SelectOption<SelectKey>> = useGroupByFields({
    tags,
    groupBys,
  });

  const groupByOptions: Array<SelectOption<SelectKey>> = useMemo(() => {
    return rawGroupByOptions.map(option => {
      return {
        ...option,
        value: `${GROUP_BY_PREFIX}${option.value}`,
      };
    });
  }, [rawGroupByOptions]);

  const functionOrGroupByOptions: Array<SelectSection<SelectKey>> = useMemo(() => {
    return [
      {
        options: functionOptions,
        label: t('Functions'),
      },
      {
        options: groupByOptions,
        label: t('Group By'),
      },
    ];
  }, [functionOptions, groupByOptions]);

  const handleColumnChange = useCallback(
    (option: SelectOption<SelectKey>) => {
      if (typeof option.value !== 'string') {
        return;
      }

      if (option.value.startsWith(GROUP_BY_PREFIX)) {
        const groupByValue = option.value.substring(GROUP_BY_PREFIX.length);
        onChange({groupBy: groupByValue});
      }
      if (option.value.startsWith(FUNCTION_PREFIX)) {
        const functionValue = option.value.substring(FUNCTION_PREFIX.length);

        if (isGroupBy(parsedField)) {
          const yAxis = updateVisualizeAggregate({
            newAggregate: functionValue,
          });
          onChange(new Visualize([yAxis]));
        } else {
          const yAxis = updateVisualizeAggregate({
            newAggregate: functionValue,
            oldAggregate: parsedField?.name,
            oldArgument: parsedField?.arguments[0],
          });
          onChange((field as Visualize).replace({yAxes: [yAxis]}));
        }
      }
    },
    [field, parsedField, onChange]
  );

  const {label, value} = useMemo(() => {
    if (defined(parsedField)) {
      if (isGroupBy(parsedField)) {
        const groupByValue = `${GROUP_BY_PREFIX}${parsedField.groupBy}`;
        const option = groupByOptions.find(opt => opt.value === groupByValue);
        return {
          label: <TriggerLabel>{option?.label ?? parsedField.groupBy}</TriggerLabel>,
          value: option?.value ?? groupByValue,
        };
      }
      const functionValue = `${FUNCTION_PREFIX}${parsedField.name}`;
      const option = functionOptions.find(opt => opt.value === functionValue);
      return {
        label: <TriggerLabel>{option?.label ?? parsedField.name}</TriggerLabel>,
        value: option?.value ?? functionValue,
      };
    }
    return {label: t('\u2014'), value: GROUP_BY_PREFIX};
  }, [parsedField, groupByOptions, functionOptions]);

  return (
    <FunctionOrGroupByCompactSelect
      data-test-id="editor-function-or-group-by"
      options={functionOrGroupByOptions}
      triggerLabel={label}
      value={value}
      onChange={handleColumnChange}
      searchable
      triggerProps={{
        prefix:
          !defined(parsedField) || isGroupBy(parsedField) ? t('Group By') : t('Function'),
        style: {
          width: '100%',
        },
      }}
    />
  );
}

interface ArgumentSelectorProps {
  field: AggregateField;
  numberTags: TagCollection;
  onChange: (column: AggregateField) => void;
  parsedFunction: ParsedFunction;
  stringTags: TagCollection;
  yAxes: string[];
}

function ArgumentSelector({
  field,
  parsedFunction,
  onChange,
  numberTags,
  stringTags,
  yAxes,
}: ArgumentSelectorProps) {
  const fieldOptions: Array<SelectOption<string>> = useVisualizeFields({
    numberTags,
    stringTags,
    yAxes,
    parsedFunction,
  });

  const handleColumnChange = useCallback(
    (option: SelectOption<SelectKey>) => {
      const yAxis = `${parsedFunction.name}(${option.value})`;
      onChange((field as Visualize).replace({yAxes: [yAxis]}));
    },
    [field, parsedFunction.name, onChange]
  );

  return (
    <ArgumentCompactSelect
      data-test-id="editor-function-or-group-by"
      searchable
      options={fieldOptions}
      value={parsedFunction.arguments[0] ?? ''}
      onChange={handleColumnChange}
      triggerProps={{
        style: {
          width: '100%',
        },
      }}
    />
  );
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};

  :not(:first-child) {
    margin-top: ${space(1)};
  }
`;

const StyledButton = styled(Button)`
  padding-left: 0;
  padding-right: 0;
`;

const FunctionOrGroupByCompactSelect = styled(CompactSelect)`
  flex-grow: 1;
  min-width: 0;
`;

const ArgumentCompactSelect = styled(CompactSelect)`
  flex-grow: 2;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
  line-height: normal;
  position: relative;
  font-weight: normal;
`;
